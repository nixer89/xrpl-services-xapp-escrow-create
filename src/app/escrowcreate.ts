import { Component, ViewChild, OnInit, Input, OnDestroy } from '@angular/core';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import * as normalizer from './utils/normalizers'
import { isValidXRPAddress } from './utils/utils';
import { MatStepper } from '@angular/material/stepper';
import { XummService } from './services/xumm.service';
import { XRPLWebsocket } from './services/xrplWebSocket';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenericBackendPostRequest, TransactionValidation } from './utils/types';
import { XummTypes } from 'xumm-sdk';
import { webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { Subscription, Observable } from 'rxjs';
import { DeviceDetectorService } from 'ngx-device-detector';
import { OverlayContainer } from '@angular/cdk/overlay';
import * as flagUtils from './utils/flagutils';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'escrowcreate',
  templateUrl: './escrowcreate.html',
  styleUrls: ['./escrowcreate.css']
})
export class EscrowCreateComponent implements OnInit, OnDestroy {

  constructor(private xummService: XummService,
              private xrplWebSocket: XRPLWebsocket,
              private snackBar: MatSnackBar,
              private overlayContainer: OverlayContainer,
              private device:DeviceDetectorService,
              private googleAnalytics: GoogleAnalyticsService) { }


  @ViewChild('inpamount') inpamount;
  amountInput: string;

  @ViewChild('inpdestination') inpdestination;
  destinationInput: string;

  @ViewChild('inpcancelafterdate') inpcancelafterdate;
  cancelafterDateInput: any;

  @ViewChild('inpcancelaftertime') inpcancelaftertime;
  cancelafterTimeInput: any;

  @ViewChild('inpfinishafterdate') inpfinishafterdate;
  finishafterDateInput: any;

  @ViewChild('inpfinishaftertime') inpfinishaftertime;
  finishafterTimeInput: any;

  @ViewChild('inppassword') password;
  passwordInput: string;

  @ViewChild('escrowStepper') stepper: MatStepper;

  @Input()
  ottChanged: Observable<any>;

  dateFormCtrl:FormControl = new FormControl(new Date());

  websocket: WebSocketSubject<any>;

  originalAccountInfo:any;
  testMode:boolean = false;

  private ottReceived: Subscription;

  isValidEscrow:boolean = false;
  validAmount:boolean = false;
  validAddress:boolean = false;
  validCancelAfter:boolean = false;
  validFinishAfter:boolean = false;
  validCondition:boolean = false;

  cancelAfterDateTime:Date;
  finishAfterDateTime:Date;

  cancelDateInFuture:boolean = false;
  finishDateInFuture:boolean = false;
  cancelDateBeforeFinishDate:boolean = false;

  escrowYears:number = 0;
  maxSixDigits:boolean = false;

  dateTimePickerSupported:boolean = true;

  loadingData:boolean = false;

  hidePw = true;

  createdEscrow:any = {}
  escrowReleaseData: any = {};

  infoLabel:string = null;
  infoLabel2:string = null;
  autoReleaseActivated:boolean = false;
  escrowDestinationSigned:boolean = false;
  escrowDestinationHasDestTagEnabled:boolean = false;

  ngOnInit() {
    this.ottReceived = this.ottChanged.subscribe(async ottData => {
      //this.infoLabel = JSON.stringify(ottData);
      //console.log("ottReceived: " + JSON.stringify(ottData));

      if(ottData) {

        this.testMode = ottData.nodetype == 'TESTNET';
        //this.infoLabel = "changed mode to testnet: " + this.testMode;

        let themeClass = 'dark-theme';
        let backgroundColor = '#000000';

        if(ottData.style) {
          switch(ottData.style) {
            case 'LIGHT':
              themeClass = 'light-theme';
              backgroundColor = '#FFFFFF';
              break;
            case 'DARK':
              themeClass = 'dark-theme';
              backgroundColor = '#000000';
              break;
            case 'MOONLIGHT':
              themeClass = 'moonlight-theme';
              backgroundColor = '#181A21';
              break;
            case 'ROYAL':
              themeClass = 'royal-theme';
              backgroundColor = '#030B36';
              break;
            default:
              themeClass = 'dark-theme';
              backgroundColor = '#000000';
              break;
          }
        }

        var bodyStyles = document.body.style;
        bodyStyles.setProperty('--background-color', backgroundColor);
        this.overlayContainer.getContainerElement().classList.remove('dark-theme');
        this.overlayContainer.getContainerElement().classList.remove('light-theme');
        this.overlayContainer.getContainerElement().classList.remove('moonlight-theme');
        this.overlayContainer.getContainerElement().classList.remove('royal-theme');
        this.overlayContainer.getContainerElement().classList.add(themeClass);

        if(ottData && ottData.account && ottData.accountaccess == 'FULL') {

          await this.loadAccountData(ottData.account);

          //await this.loadAccountData(ottData.account); //false = ottResponse.node == 'TESTNET' 
        } else {
          this.originalAccountInfo = "no account";
        }
      }
    });
    //this.infoLabel = JSON.stringify(this.device.getDeviceInfo());

    //this.dateTimePickerSupported = !(this.device && this.device.getDeviceInfo() && this.device.getDeviceInfo().os_version && (this.device.getDeviceInfo().os_version.toLowerCase().includes('ios') || this.device.getDeviceInfo().browser.toLowerCase().includes('safari') || this.device.getDeviceInfo().browser.toLowerCase().includes('edge')));
    this.dateTimePickerSupported = true;
  }

  ngOnDestroy() {
    if(this.ottReceived)
      this.ottReceived.unsubscribe();
  }

  checkChanges(signedDestinationAcc?: boolean) {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    if(this.dateTimePickerSupported) {
      if(this.cancelafterDateInput && this.cancelafterTimeInput)
        this.cancelAfterDateTime = new Date(this.cancelafterDateInput.trim() + " " + this.cancelafterTimeInput.trim())
      else
        this.cancelAfterDateTime = null;
    } else {
      if(this.cancelafterDateInput && this.cancelafterDateInput.length == 4 && Number.isInteger(Number(this.cancelafterDateInput)))
        this.cancelafterDateInput+="-"

      if(this.cancelafterDateInput && this.cancelafterDateInput.length == 7 && Number.isInteger(Number(this.cancelafterDateInput.substring(5,7))))
        this.cancelafterDateInput+="-"

      this.cancelAfterDateTime = this.handleDateAndTimeNonPicker(this.cancelafterDateInput, this.cancelafterTimeInput);
    }

    this.cancelDateInFuture = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() < Date.now();
    this.validCancelAfter = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() > 0;

    if(this.dateTimePickerSupported) {
      if(this.dateFormCtrl && this.dateFormCtrl.value && this.finishafterTimeInput) {
        let datePicker = new Date(this.dateFormCtrl.value);
        this.infoLabel = datePicker.getFullYear() + "-" + ((datePicker.getMonth()+1) < 10 ? "0":"")+(datePicker.getMonth()+1) + "-" + datePicker.getDate() + "T" + this.finishafterTimeInput.trim();
        this.finishAfterDateTime = new Date(datePicker.getFullYear() + "-" + ((datePicker.getMonth()+1) < 10 ? "0":"")+(datePicker.getMonth()+1) + "-" + datePicker.getDate() + "T" + this.finishafterTimeInput.trim());    
      }
      else
        this.finishAfterDateTime = null;
    } else {
      if(this.finishafterDateInput && this.finishafterDateInput.length == 4 && Number.isInteger(Number(this.finishafterDateInput)))
        this.finishafterDateInput+="-"

      if(this.finishafterDateInput && this.finishafterDateInput.length == 7 && Number.isInteger(Number(this.finishafterDateInput.substring(5,7))))
        this.finishafterDateInput+="-"

      this.finishAfterDateTime = this.handleDateAndTimeNonPicker(this.finishafterDateInput, this.finishafterTimeInput);
    }
    
    this.finishDateInFuture = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() < Date.now();
    this.validFinishAfter = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() > 0 && !this.finishDateInFuture;
    
    if(this.finishAfterDateTime)
      this.escrowYears = this.finishAfterDateTime.getFullYear() - (new Date()).getFullYear();
    

    if(this.validCancelAfter && this.validFinishAfter)
      this.cancelDateBeforeFinishDate = this.finishAfterDateTime.getTime() >= this.cancelAfterDateTime.getTime();
    else
      this.cancelDateBeforeFinishDate = false;

    if(this.amountInput) {
      this.validAmount = !(/[^.0-9]|\d*\.\d{7,}/.test(this.amountInput));

      if(!this.validAmount) {
        this.maxSixDigits = this.amountInput.includes('.') && this.amountInput.split('.')[1].length > 6;
      } else {
        this.maxSixDigits = false;
      }
    }

    if(this.validAmount)
      this.validAmount = this.amountInput && parseFloat(this.amountInput) >= 0.000001 && !this.escrowBiggerThanAvailable();

    this.validAddress = this.destinationInput && this.destinationInput.trim().length > 0 && isValidXRPAddress(this.destinationInput.trim());

    if(this.validAddress)
      this.escrowDestinationSigned = signedDestinationAcc;

    this.validCondition = this.passwordInput && this.passwordInput.trim().length > 0;

    if(this.validAmount && this.validAddress && (this.validFinishAfter || this.validCondition)) {
      if(this.validCondition)
        this.isValidEscrow = this.validFinishAfter || this.validCancelAfter
      else
        this.isValidEscrow = this.validFinishAfter 
    }
    else
      this.isValidEscrow = false;

    if(this.isValidEscrow && this.validFinishAfter && this.validCancelAfter) {
      this.isValidEscrow = !this.cancelDateBeforeFinishDate && !this.cancelDateInFuture && !this.finishDateInFuture;
    }

    //console.log("isValidEscrow: " + this.isValidEscrow);
  }

  handleDateAndTimeNonPicker(dateInput: string, timeInput: string): Date {
    let dateTime:Date = null;

    if(dateInput && dateInput.trim().length > 0)
      dateTime = new Date(dateInput.trim());
    else
      dateTime = null;

    if(timeInput && timeInput.trim().length > 0 && dateTime) {
      let splitValues:string[] = timeInput.trim().split(':');

      if(splitValues) {
        if(splitValues[0] && Number.isInteger(Number.parseInt(splitValues[0])))
          dateTime.setHours(Number.parseInt(splitValues[0]));

        if(splitValues[1] && Number.isInteger(Number.parseInt(splitValues[1])))
          dateTime.setMinutes(Number.parseInt(splitValues[1]));

        if(splitValues[2] && Number.isInteger(Number.parseInt(splitValues[2])))
          dateTime.setSeconds(Number.parseInt(splitValues[2]));
      }
    }

    return dateTime;
  }

  sendPayloadToXumm() {
    this.loadingData = true;
    //this.infoLabel = "sending payload";
    try {
    //this.googleAnalytics.analyticsEventEmitter('escrow_create', 'sendToXumm', 'escrow_create_component');
    let xummPayload:XummTypes.XummPostPayloadBodyJson = {
      options: {
        expire: 5,
        forceAccount: true
      },
      txjson: {
        TransactionType: "EscrowCreate",
        Account: this.originalAccountInfo.Account
      }, custom_meta: {
        instruction: ""
      }
    }

    if(this.escrowYears > 10) {
      xummPayload.custom_meta.instruction += "ATTENTION: Your XRP will be inaccessible for " + this.escrowYears + "years!\n\n";
    }

    if(this.destinationInput && this.destinationInput.trim().length>0 && isValidXRPAddress(this.destinationInput)) {
      xummPayload.txjson.Destination = this.destinationInput.trim();
      xummPayload.custom_meta.instruction += "- Escrow Destination: " + this.destinationInput.trim();
    }

    
    if(this.amountInput && parseFloat(this.amountInput) >= 0.000001) {
      xummPayload.txjson.Amount = parseFloat(this.amountInput)*1000000+"";
      xummPayload.custom_meta.instruction += "\n- Escrow Amount: " + this.amountInput;
    }
 
    if(this.validCancelAfter) {
      xummPayload.txjson.CancelAfter = normalizer.utcToRippleEpocheTime(this.cancelAfterDateTime.getTime());
      xummPayload.custom_meta.instruction += "\n- Cancel After (UTC): " + this.cancelAfterDateTime.toUTCString();
    }

    if(this.validFinishAfter) {
      xummPayload.txjson.FinishAfter = normalizer.utcToRippleEpocheTime(this.finishAfterDateTime.getTime());
      xummPayload.custom_meta.instruction += "\n- Finish After (UTC): " + this.finishAfterDateTime.toUTCString();
    }

    if(this.validCondition) {
      let fulfillment_bytes:Buffer = Buffer.from(this.passwordInput.trim(), 'utf-8');

      
      import('five-bells-condition').then( cryptoCondition => {
        let myFulfillment = new cryptoCondition.PreimageSha256();

        myFulfillment.setPreimage(fulfillment_bytes);

        let fulfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase()
        //console.log('Fulfillment: ', fulfillment)
        //console.log('             ', myFulfillment.serializeUri())

        var condition = myFulfillment.getConditionBinary().toString('hex').toUpperCase()
        //console.log('Condition  : ', condition)
          // 'A0258020' + sha256(fulfillment_bytes) + '810102'
        //console.log('             ', myFulfillment.getCondition().serializeUri())

        //console.log()

        //console.log(
        //  'Fulfillment valid for Condition?      ',
        //    cryptoCondition.validateFulfillment(
        //    cryptoCondition.Fulfillment.fromBinary(Buffer.from(fulfillment, 'hex')).serializeUri(), 
        //    cryptoCondition.Condition.fromBinary(Buffer.from(condition, 'hex')).serializeUri()
        //  )
        //)

        xummPayload.txjson.Condition = condition;
        xummPayload.custom_meta.instruction += "\n- With a password ✓";

        let backendRequest: GenericBackendPostRequest = {
          options: {
            web: false,
            xrplAccount: this.originalAccountInfo.Account
          },
          payload: xummPayload
        }

        this.waitForTransactionSigning(backendRequest);
      });      
    } else {
      let backendRequest: GenericBackendPostRequest = {
        options: {
          web: false,
          xrplAccount: this.originalAccountInfo.Account
        },
        payload: xummPayload
      }

      this.waitForTransactionSigning(backendRequest);
    }
  } catch(err) {
    //this.infoLabel = JSON.stringify(err);
  }
  }

  async waitForTransactionSigning(payloadRequest: GenericBackendPostRequest) {
    //this.infoLabel = "Opening sign request";
    let xummResponse:XummTypes.XummPostPayloadResponse;
    try {
        //console.log("sending xumm payload: " + JSON.stringify(xummPayload));
        xummResponse = await this.xummService.submitPayload(payloadRequest);
        //this.infoLabel = "Called xumm successfully"
        console.log(JSON.stringify(xummResponse));
        if(!xummResponse || !xummResponse.uuid) {
          this.loadingData = false;
          this.snackBar.open("Error contacting XUMM backend", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
          return;
        }        
    } catch (err) {
        //console.log(JSON.stringify(err));
        this.loadingData = false;
        this.snackBar.open("Could not contact XUMM backend", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        return;
    }

    let trxType = payloadRequest.options.signinToValidate ? "Sign In" : "Escrow creation"

    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'openSignRequest',
        uuid: xummResponse.uuid
      }));
    }

    this.websocket = webSocket(xummResponse.refs.websocket_status);
    this.websocket.asObservable().subscribe(async message => {
        //console.log("message received: " + JSON.stringify(message));
        if(message.payload_uuidv4 && message.payload_uuidv4 === xummResponse.uuid) {
            
            if(message.signed) {
                let transactionResult:TransactionValidation = null;
                //check if we are an EscrowReleaser payment
                if(payloadRequest.payload.txjson.TransactionType.toLowerCase() == 'payment' && payloadRequest.payload.custom_meta && payloadRequest.payload.custom_meta.blob && !payloadRequest.options.signinToValidate)
                  transactionResult = await this.xummService.validateEscrowPayment(message.payload_uuidv4);
                if(payloadRequest.options.signinToValidate)
                  transactionResult = await this.xummService.checkSignIn(message.payload_uuidv4);
                else
                  transactionResult = await this.xummService.validateTransaction(message.payload_uuidv4);

                console.log("trx result: " + JSON.stringify(transactionResult));
//                this.infoLabel = JSON.stringify(transactionResult);

                if(this.websocket) {
                    this.websocket.unsubscribe();
                    this.websocket.complete();
                }

                if(transactionResult && transactionResult.success) {
                  if(payloadRequest.options.signinToValidate) {
                    if(payloadRequest.payload.custom_meta && payloadRequest.payload.custom_meta.blob && payloadRequest.payload.custom_meta.blob.source == "EscrowOwner") {
                      await this.loadAccountData(transactionResult.account);
                      this.snackBar.open("Sign In successfull", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
                    } else {
                      if(await this.checkIfDestinationAccountExists(transactionResult.account)) {
                        this.destinationInput = transactionResult.account;
                        this.snackBar.open("Destination address inserted", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
                        this.checkChanges(true);
                      } else {
                        this.destinationInput = null;
                        this.snackBar.open("Account not existent on " + (this.testMode ? "TESTNET" : "MAINNET"), null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
                        this.checkChanges();
                      }
                    }
                  } else {
                    if(payloadRequest.payload.txjson.TransactionType.toLowerCase() === 'payment' && payloadRequest.payload.custom_meta && payloadRequest.payload.custom_meta.blob) {
                      this.snackBar.open("Auto Release activated!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
                      this.autoReleaseActivated = true;
                    } else {
                      this.snackBar.open("Escrow created!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
                      await this.loadCreatedEscrowData(transactionResult.txid);
                      this.moveNext();
                    }
                  }
                } else {
                  this.snackBar.open(trxType+" not successfull!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
                }
            } else {
              this.snackBar.open(trxType+" not successfull!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
            }

            this.loadingData = false;

        } else if(message.expired || message.expires_in_seconds <= 0) {
          this.loadingData = false;
          this.snackBar.open(trxType+" not successfull!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
    });
  }

  getAvailableBalanceForEscrow(): number {
    if(this.originalAccountInfo && this.originalAccountInfo.Balance) {
      let balance:number = Number(this.originalAccountInfo.Balance);
      balance = balance - (20*1000000); //deduct acc reserve
      balance = balance - (this.originalAccountInfo.OwnerCount * 5 * 1000000); //deduct owner count
      balance = balance - 5 * 1000000; //deduct account reserve for escrow
      balance = balance/1000000;

      if(balance >= 0.000001)
        return balance
      else
        return 0;
      
    } else {
      return 0;
    }
  }

  async signInWithEscrowOwner() {
    this.loadingData = true;
    //setting up xumm payload and waiting for websocket
    let backendPayload:GenericBackendPostRequest = {
      options: {
          web: false,
          signinToValidate: true
      },
      payload: {
          options: {
              expire: 5
          },
          txjson: {
              TransactionType: "SignIn"
          },
          custom_meta: {
            blob: { source: "EscrowOwner"}
          }
      }
    }

    this.waitForTransactionSigning(backendPayload);
  }

  escrowBiggerThanAvailable(): boolean {
    return this.originalAccountInfo && this.amountInput && parseFloat(this.amountInput) > this.getAvailableBalanceForEscrow();
  }

  scanForDestination() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      this.loadingData = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'scanQr'
      }));

      window.addEventListener("message", async event => {
        console.log(event.data);
        let qrResult = JSON.parse(event.data);
        //this.infoLabel = "QR-result: " + JSON.stringify(qrResult);
        if(qrResult.method == "scanQr" && qrResult.reason == "SCANNED" && isValidXRPAddress(qrResult.qrContents)) {
          if((await this.checkIfDestinationAccountExists(qrResult.qrContents))) {
            this.destinationInput = qrResult.qrContents;
            this.snackBar.open("Destination address inserted", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
            this.checkChanges();
          } else {
            this.destinationInput = null;
            this.snackBar.open("Account not existent on " + (this.testMode ? "TESTNET" : "MAINNET"), null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
            this.checkChanges();
          }
        } else if(qrResult.method == "scanQr" && qrResult.reason == "USER_CLOSE") {
          //do not do anything on user close
        } else {
          this.destinationInput = null;
          this.snackBar.open("Invalid XRPL account", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
          this.checkChanges();
        }
        this.loadingData = false;
      });
    }
  }

  async signInForDestination() {
    this.loadingData = true;
    //setting up xumm payload and waiting for websocket
    let backendPayload:GenericBackendPostRequest = {
      options: {
          web: false,
          signinToValidate: true
      },
      payload: {
          options: {
              expire: 5
          },
          txjson: {
              TransactionType: "SignIn"
          },
          custom_meta: {
            blob: { source: "EscrowDestination"}
          }
      }
    }

    this.waitForTransactionSigning(backendPayload);
  }

  clearInputs() {
    this.destinationInput = this.amountInput = null;
    this.cancelafterDateInput = this.cancelafterTimeInput = this.cancelAfterDateTime = null;
    this.finishafterDateInput = this.finishafterTimeInput = this.finishAfterDateTime = null;

    this.cancelDateInFuture =  this.finishDateInFuture = this.cancelDateBeforeFinishDate = false;

    this.isValidEscrow = this.validAddress = this.validAmount = this.validCancelAfter = this.validFinishAfter = this.validCondition = false;

    this.passwordInput = null;
  }

  async loadAccountData(xrplAccount: string) {
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount && isValidXRPAddress(xrplAccount)) {
      //this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'account_data', 'xrpl_transactions_component');
      this.loadingData = true;

      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("xrpl-transactions", account_info_request, this.testMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          this.originalAccountInfo = message_acc_info.result.account_data;
        } else {
          this.originalAccountInfo = message_acc_info;
        }
      } else {
        this.originalAccountInfo = "no account";
      }

      this.loadingData = false;
    } else {
      this.originalAccountInfo = "no account"
    }
  }

  async checkIfDestinationAccountExists(xrplAccount: string) {
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount) {
      //this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'account_data', 'xrpl_transactions_component');
      this.loadingData = true;

      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("xrpl-transactions", account_info_request, this.testMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          let accData:any = message_acc_info.result.account_data;

          if(accData.Flags)
            this.escrowDestinationHasDestTagEnabled = flagUtils.isRequireDestinationTagEnabled(accData.Flags);

          return accData.Account && isValidXRPAddress(accData.Account);
        } else {
          return false
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  async loadCreatedEscrowData(txId: string): Promise<void> {
    this.loadingData = true;
    let txInfo:any = {
        command: "tx",
        transaction: txId,
    }

    let message:any = await this.xrplWebSocket.getWebsocketMessage("escrowListExecuter", txInfo, this.testMode);

    //this.infoLabel = JSON.stringify(message);

    if(message && message.status && message.status === 'success' && message.type && message.type === 'response') {
        if(message.result && message.result.TransactionType === 'EscrowCreate') {
            //console.log("Sequence: " + message.result.Sequence);
            this.createdEscrow = message.result;
            //this.infoLabel = JSON.stringify(this.createdEscrow);
            this.loadingData = false;
        }
    }
  }

  addEscrowToAutoReleaser() {
    this.loadingData = true;
    let genericBackendRequest:GenericBackendPostRequest = {
        options: {
            xrplAccount: this.createdEscrow.Account
        },
        payload: {
          options: {
            forceAccount: true
          },
          txjson: {
              TransactionType: "Payment",
              Account: this.originalAccountInfo.Account,
              Memos : [{Memo: {MemoType: Buffer.from("[https://xumm.community]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for Auto Release of Escrow! Owner:" + this.createdEscrow.Account + " Sequence: " + this.createdEscrow.Sequence, 'utf8').toString('hex').toUpperCase()}}]
          },
          custom_meta: {
              instruction: "SIGN WITH ESCROW OWNER ACCOUNT!!!\n\nEnable Auto Release for Escrow!\n\nEscrow-Owner: " + this.createdEscrow.Account + "\nSequence: " + this.createdEscrow.Sequence + "\nFinishAfter: " + new Date(normalizer.rippleEpocheTimeToUTC(this.createdEscrow.FinishAfter)).toLocaleString(),
              blob: {account: this.createdEscrow.Account, sequence: this.createdEscrow.Sequence, finishafter: normalizer.rippleEpocheTimeToUTC(this.createdEscrow.FinishAfter), testnet: this.testMode}
          },
        }
    }

    this.waitForTransactionSigning(genericBackendRequest);
    
  }

  isAbleToAutoRelease(): boolean {
    return this.createdEscrow && this.createdEscrow.FinishAfter && !this.createdEscrow.Condition && (!this.createdEscrow.CancelAfter || (this.createdEscrow.CancelAfter - this.createdEscrow.FinishAfter) > 90*60)
  }

  getExpectedAutoReleaseTime(): string {
    if(this.createdEscrow.FinishAfter) {
        let expectedRelease:Date = new Date(normalizer.rippleEpocheTimeToUTC(this.createdEscrow.FinishAfter));

        //set execution time to now + next hour + 5 min in case to enable auto release for already finishable escrows
        if(expectedRelease.getTime() < Date.now())
            expectedRelease.setTime(Date.now());

        expectedRelease.setHours(expectedRelease.getHours()+1);
        expectedRelease.setMinutes(5,0,0);
        return expectedRelease.toLocaleString();
    } else
        return "-";
}

  close() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'close'
      }));
    }
  }

  moveNext() {
    // complete the current step
    this.stepper.selected.completed = true;
    this.stepper.selected.editable = false;
    // move to next step
    this.stepper.next();
    this.stepper.selected.editable = true;
  }

  moveBack() {
    //console.log("steps: " + this.stepper.steps.length);
    // move to previous step
    this.stepper.selected.completed = false;
    this.stepper.selected.editable = false;

    this.stepper.steps.forEach((item, index) => {
      if(index == this.stepper.selectedIndex-1 && this.stepper.selectedIndex-1 >= 0) {
        item.editable = true;
        item.completed = false;
      }
    });

    this.stepper.previous();
  }
}
