import { Component, ViewChild, OnInit } from '@angular/core';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import * as normalizer from './utils/normalizers'
import { isValidXRPAddress } from './utils/utils';
import { MatStepper } from '@angular/material/stepper';
import { ActivatedRoute } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { XummService } from './services/xumm.service';
import { XRPLWebsocket } from './services/xrplWebSocket';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenericBackendPostRequest, TransactionValidation } from './utils/types';
import { XummTypes } from 'xumm-sdk';
import { webSocket, WebSocketSubject} from 'rxjs/webSocket';

@Component({
  selector: 'escrowcreate',
  templateUrl: './escrowcreate.html',
  styleUrls: ['./escrowcreate.css']
})
export class EscrowCreateComponent implements OnInit {

  constructor(private route: ActivatedRoute,
              private xummService: XummService,
              private xrplWebSocket: XRPLWebsocket,
              private snackBar: MatSnackBar,
              private googleAnalytics: GoogleAnalyticsService) {}


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

  websocket: WebSocketSubject<any>;

  originalAccountInfo:any;

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

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      let xAppToken = params.xAppToken;
      let testMode =  (params.node && params.node == 'TESTNET') || true;

      console.log("received pararms: " + JSON.stringify(params));

      if(xAppToken) {
        let ottResponse:any = await this.xummService.getxAppOTTData(xAppToken);

        console.log("ottResponse: " + JSON.stringify(ottResponse));
        if(ottResponse && ottResponse.account && ottResponse.accountaccess == 'FULL') {
          await this.loadAccountData(ottResponse.account, testMode); //false = ottResponse.node == 'TESTNET' 
        }
      }
    });

    this.dateTimePickerSupported = false;//!(this.device && this.device.getDeviceInfo() && this.device.getDeviceInfo().os_version && (this.device.getDeviceInfo().os_version.toLowerCase().includes('ios') || this.device.getDeviceInfo().browser.toLowerCase().includes('safari') || this.device.getDeviceInfo().browser.toLowerCase().includes('edge')));
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    if(this.dateTimePickerSupported) {
      if(this.cancelafterDateInput && this.cancelafterTimeInput)
        this.cancelAfterDateTime = new Date(this.cancelafterDateInput.trim() + " " + this.cancelafterTimeInput.trim())
      else
        this.cancelAfterDateTime = null;
    } else {
      this.cancelAfterDateTime = this.handleDateAndTimeNonPicker(this.cancelafterDateInput, this.cancelafterTimeInput);
    }

    this.cancelDateInFuture = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() < Date.now();
    this.validCancelAfter = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() > 0;

    if(this.dateTimePickerSupported) {
      if(this.finishafterDateInput && this.finishafterTimeInput)
        this.finishAfterDateTime = new Date(this.finishafterDateInput.trim() + " " + this.finishafterTimeInput.trim());
      else
        this.finishAfterDateTime = null;
    } else {
      this.finishAfterDateTime = this.handleDateAndTimeNonPicker(this.finishafterDateInput, this.finishafterTimeInput);
    }
    
    this.finishDateInFuture = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() < Date.now();
    this.validFinishAfter = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() > 0;
    
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

    this.googleAnalytics.analyticsEventEmitter('escrow_create', 'sendToXumm', 'escrow_create_component');
    let xummPayload:XummTypes.XummPostPayloadBodyJson = {
      options: {
        expire: 5,
        submit: true
      },
      txjson: {
        TransactionType: "EscrowCreate"
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
            signinToValidate: false,
            web: false
          },
          payload: xummPayload
        }

        this.waitForTransactionSigning(backendRequest);
      });      
    } else {
      let backendRequest: GenericBackendPostRequest = {
        options: {
          signinToValidate: false,
          web: false
        },
        payload: xummPayload
      }

      this.waitForTransactionSigning(backendRequest);
    }
  }

  async waitForTransactionSigning(payloadRequest: GenericBackendPostRequest) {
    let xummResponse:XummTypes.XummPostPayloadResponse;
    try {
        //console.log("sending xumm payload: " + JSON.stringify(xummPayload));
        xummResponse = await this.xummService.submitPayload(payloadRequest);
        //console.log(JSON.stringify(xummResponse));
        if(!xummResponse || !xummResponse.uuid) {
          this.snackBar.open("Error contacting XUMM backend", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }        
    } catch (err) {
        //console.log(JSON.stringify(err));
        this.snackBar.open("Could not contact XUMM backend", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
    }

    let trxType = payloadRequest.options.signinToValidate ? "Sign In" : "Escrow creation"
    this.websocket = webSocket(xummResponse.refs.websocket_status);
    this.websocket.asObservable().subscribe(async message => {
        //console.log("message received: " + JSON.stringify(message));
        if(message.payload_uuidv4 && message.payload_uuidv4 === xummResponse.uuid) {
            
            if(message.signed) {
                let transactionResult:TransactionValidation = null;
                if(payloadRequest.options.signinToValidate)
                  transactionResult = await this.xummService.checkSignIn(message.payload_uuidv4);
                else
                  transactionResult = await this.xummService.validateTransaction(message.payload_uuidv4);

                console.log("sign result: " + JSON.stringify(transactionResult));

                if(this.websocket) {
                    this.websocket.unsubscribe();
                    this.websocket.complete();
                }

                if(transactionResult && transactionResult.success) {
                  if(payloadRequest.options.signinToValidate)
                    this.destinationInput = transactionResult.account;
                  else
                    this.snackBar.open("Escrow created!", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});  
                } else {
                  this.snackBar.open(trxType+" not successfull!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
                }
            } else {
              this.snackBar.open(trxType+" not successfull!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
            }

        } else if(message.expired || message.expires_in_seconds <= 0) {
          this.snackBar.open(trxType+" not successfull!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
    });
    
    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'openSignRequest',
        uuid: xummResponse.uuid
      }));
    }
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

  escrowBiggerThanAvailable(): boolean {
    return this.originalAccountInfo && this.amountInput && parseFloat(this.amountInput) > this.getAvailableBalanceForEscrow();
  }

  scanForOwner() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'scanQr'
      }));

      window.addEventListener("message", event => {
        console.log(event.data);
        if(event.data.reason == "SCANNED" && isValidXRPAddress(event.data.qrContents)) {
          this.destinationInput = event.data.qrContents;
          this.snackBar.open("Destination address inserted", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      })
    }
  }

  async signInForOwner() {
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

  async loadAccountData(xrplAccount: string, testMode: boolean) {
    if(xrplAccount) {
      this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'account_data', 'xrpl_transactions_component');
      this.loadingData = true;

      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("xrpl-transactions", account_info_request, testMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));

      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          this.originalAccountInfo = message_acc_info.result.account_data;
        } else {
          this.originalAccountInfo = message_acc_info;
        }
      } else {
        this.originalAccountInfo = null;
      }
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

    switch(this.stepper.selectedIndex) {
      case 0: break;
      case 1: {
        break;
      }
      case 2: {

        break;
      }
      case 3: {
        break;
      }
      case 4: {
        break;
      }
    }

    this.stepper.previous();
  }
}
