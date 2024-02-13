import { Component, ViewChild, OnInit, Input, OnDestroy } from '@angular/core';
import * as normalizer from './utils/normalizers'
import { isValidXRPAddress } from './utils/utils';
import { MatStepper } from '@angular/material/stepper';
import { XahauServices } from './services/xahau.services';
import { XahauWebsocket } from './services/xahauWebSocket';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenericBackendPostRequest, RippleState, SimpleTrustline, TransactionValidation } from './utils/types';
import { XummTypes, xAppOttData } from 'xumm-sdk';
import { webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { Subscription, Observable } from 'rxjs';
import { OverlayContainer } from '@angular/cdk/overlay';
import * as flagUtils from './utils/flagutils';
import { FormControl } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { TypeWriter } from './utils/TypeWriter';
import * as clipboard from 'copy-to-clipboard';
import { AppService } from './services/app.service';

//RippleState Flags
const lsfLowReserve = 0x10000;
const lsfHighReserve = 0x20000;

const lsfLowFreeze = 0x400000;
const lsfHighFreeze = 0x800000;

@Component({
  selector: 'escrowcreateXahau',
  templateUrl: './escrowcreateXahau.html',
  styleUrls: ['./escrowcreateXahau.css']
})
export class EscrowCreateComponentXahau implements OnInit, OnDestroy {

  constructor(private xummService: XahauServices,
              private xahauWebsocket: XahauWebsocket,
              private appService: AppService,
              private snackBar: MatSnackBar,
              private overlayContainer: OverlayContainer,
              private dateAdapter: DateAdapter<any>) {

      console.log("XAHAU CONSTRUCTOR");
  }


  @ViewChild('inpamount') inpamount;
  amountInput: string;

  @ViewChild('inpdestination') inpdestination;
  destinationInput: string;

  @ViewChild('inpcancelaftertime') inpcancelaftertime;
  cancelafterTimeInput: any;

  @ViewChild('inpfinishaftertime') inpfinishaftertime;
  finishafterTimeInput: string;

  @ViewChild('escrowStepper') stepper: MatStepper;

  @Input()
  ottChanged: Observable<xAppOttData>;

  @Input()
  themeChanged: Observable<any>;

  finishAfterFormCtrl:FormControl = new FormControl();
  cancelAfterFormCtrl:FormControl = new FormControl();

  websocket: WebSocketSubject<any>;

  originalAccountInfo:any;
  testMode:boolean = false;

  destinationTag:number = null;
  destinationName:string = null;
  destinationHasTrustline:boolean = false;

  xummMajorVersion:number = null;
  xummMinorVersion:number = null;

  force_xahau_main:string = "XAHAU";
  force_xahau_test:string = "XAHAUTESTNET";

  private ottReceived: Subscription;
  private themeReceived: Subscription;

  isValidEscrow:boolean = false;
  validAmount:boolean = false;
  validAddress:boolean = false;
  validCancelAfter:boolean = false;
  validFinishAfter:boolean = false;

  cancelAfterDateTime:Date;
  finishAfterDateTime:Date;

  cancelDateInFuture:boolean = false;
  finishDateInFuture:boolean = false;
  cancelDateBeforeFinishDate:boolean = false;

  escrowYears:number = 0;
  maxSixDigits:boolean = false;

  dateTimePickerSupported:boolean = true;

  loadingData:boolean = true;
  initializing:boolean = true;

  applyFilters:boolean = false;

  createdEscrow:any = {}
  escrowReleaseData: any = {};

  existingAccountLines:RippleState[] = [];
  simpleTrustlines:SimpleTrustline[] = [];
  selectedToken:SimpleTrustline = null;
  searchString:string = null;
  issuerHasGlobalFreezeSet:boolean = false;

  infoLabel:string = null;
  autoReleaseActivated:boolean = false;
  escrowDestinationSigned:boolean = false;
  escrowDestinationHasDestTagEnabled:boolean = false;
  destinationAccountExists = false;
  validatingEscrow:boolean = false;
  ownerHasBalanceForOwnerReserve:boolean = false;

  checkBoxYears:boolean = false;

  oldDestinationInput:string = null;

  title: string = "XRPL Services xApp";
  tw: TypeWriter

  themeClass = 'dark-theme';
  backgroundColor = '#000000';

  errorLabel:string = null;

  accountReserve:number = 1000000;
  ownerReserve:number = 200000;

  termsAndConditions:boolean = false;

  xummOutdated:boolean = false;
  isXahauConnected:boolean = false;

  accountNames:any[] = [];

  ngOnInit() {
    console.log("XAHAU NG INIT!");
    this.ottReceived = this.ottChanged.subscribe(async ottData => {
      //console.log("ottReceived: " + JSON.stringify(ottData));

      //this.testMode = true;
      //await this.loadAccountData("rELeasERs3m4inA1UinRLTpXemqyStqzwh");
      //await this.loadAccountData("r9N4v3cWxfh4x6yUNjxNy3DbWUgbzMBLdk");
      //this.testMode = true;
      //this.loadingData = false;
      //return;

      if(ottData) {

        //this.infoLabel = JSON.stringify(ottData);

        this.isXahauConnected = ottData.nodetype == 'XAHAU' || ottData.nodetype == 'XAHAUTESTNET';
        console.log("isXahauConnected: " + this.isXahauConnected);

        if(this.isXahauConnected) { //not on XRPL, continue!

          await this.loadFeeReserves();
          
          this.testMode = ottData.nodetype == this.force_xahau_test;

          if(ottData.locale)
            this.dateAdapter.setLocale(ottData.locale);
          //this.infoLabel = "changed mode to testnet: " + this.testMode;

          if(ottData.version) {
            let version:string[] = ottData.version.split('.');
            this.xummMajorVersion = Number.parseInt(version[0]);
            this.xummMinorVersion = Number.parseInt(version[1]);
          }

          if(this.xummMajorVersion < 2 || (this.xummMajorVersion == 2 && this.xummMinorVersion < 6)) {
            this.xummOutdated = true;
            console.log("XUMM IS OUTDATED: " + ottData.version);

          } else if(ottData && ottData.account && ottData.accountaccess == 'FULL') {

            await this.loadAccountData(ottData.account);

          } else {
            this.originalAccountInfo = "no account";
          }

          //add event listeners
          if (typeof window.addEventListener === 'function') {
            window.addEventListener("message", event => this.handleOverlayEvent(event));
          }
          
          if (typeof document.addEventListener === 'function') {
            document.addEventListener("message", event => this.handleOverlayEvent(event));
          }

          this.tw = new TypeWriter(["Xahau Services xApp", "created by nixerFFM", "Xahau Services xApp"], t => {
            this.title = t;
          });

        }

        this.initializing = false;
        this.loadingData = false;

        if(this.tw) {
          this.tw.start();
        }
      }
    });

    this.themeReceived = this.themeChanged.subscribe(async appStyle => {

      this.themeClass = appStyle.theme;
      this.backgroundColor = appStyle.color;

      var bodyStyles = document.body.style;
      bodyStyles.setProperty('--background-color', this.backgroundColor);
      this.overlayContainer.getContainerElement().classList.remove('dark-theme');
      this.overlayContainer.getContainerElement().classList.remove('light-theme');
      this.overlayContainer.getContainerElement().classList.remove('moonlight-theme');
      this.overlayContainer.getContainerElement().classList.remove('royal-theme');
      this.overlayContainer.getContainerElement().classList.add(this.themeClass);
    });
    //this.infoLabel = JSON.stringify(this.device.getDeviceInfo());

    //this.dateTimePickerSupported = !(this.device && this.device.getDeviceInfo() && this.device.getDeviceInfo().os_version && (this.device.getDeviceInfo().os_version.toLowerCase().includes('ios') || this.device.getDeviceInfo().browser.toLowerCase().includes('safari') || this.device.getDeviceInfo().browser.toLowerCase().includes('edge')));
    this.dateTimePickerSupported = true;
  }

  ngOnDestroy() {
    if(this.ottReceived)
      this.ottReceived.unsubscribe();

    if(this.themeReceived)
      this.themeReceived.unsubscribe();
  }

  async loadFeeReserves() {
    let fee_request:any = {
      command: "ledger_entry",
      index: "4BC50C9B0D8515D3EAAE1E74B29A95804346C491EE1A95BF25E4AAB854A6A651",
      ledger_index: "validated"
    }

    let feeSetting:any = await this.xahauWebsocket.getWebsocketMessage("fee-settings", fee_request, this.testMode);
    this.accountReserve = feeSetting?.result?.node["ReserveBaseDrops"];
    this.ownerReserve = feeSetting?.result?.node["ReserveIncrementDrops"];

    console.log("resolved accountReserve: " + this.accountReserve);
    console.log("resolved ownerReserve: " + this.ownerReserve);
  }

  async checkChanges(insertedDestinationAccount?: boolean, userHasSignedInDestination?: boolean) {
    if(!insertedDestinationAccount)
      insertedDestinationAccount = false;

    if(!userHasSignedInDestination)
      userHasSignedInDestination = false;
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);

    if(this.finishAfterFormCtrl && this.finishAfterFormCtrl.value && this.finishafterTimeInput) {
      this.finishAfterDateTime = new Date(this.finishAfterFormCtrl.value.format("yyyy-MM-DD") + "T" + this.finishafterTimeInput.trim());    
    }
    else
      this.finishAfterDateTime = null;
  
    this.finishDateInFuture = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() < Date.now();
    this.validFinishAfter = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() > 0 && !this.finishDateInFuture;
    
    if(this.finishAfterDateTime)
      this.escrowYears = this.finishAfterDateTime.getFullYear() - (new Date()).getFullYear();

    if(this.cancelAfterFormCtrl && this.cancelAfterFormCtrl.value && this.cancelafterTimeInput) {
      this.cancelAfterDateTime = new Date(this.cancelAfterFormCtrl.value.format("yyyy-MM-DD") + "T" + this.cancelafterTimeInput.trim());    
    }
    else
      this.cancelAfterDateTime = null;

    this.cancelDateInFuture = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() < Date.now();
    this.validCancelAfter = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() > 0;

    if(this.validCancelAfter && this.validFinishAfter)
      this.cancelDateBeforeFinishDate = this.finishAfterDateTime.getTime() >= this.cancelAfterDateTime.getTime();
    else
      this.cancelDateBeforeFinishDate = false;

    if(this.amountInput) {
      this.validAmount = /^[0-9]\d*(\.\d{1,15})?$/.test(this.amountInput);
      //console.log("this.validAmount 1 : " + this.validAmount);
    }

    //console.log("this.escrowBiggerThanAvailable(): " + this.escrowBiggerThanAvailable());

    if(this.validAmount)
      this.validAmount = this.amountInput && !this.escrowBiggerThanAvailable();

    //console.log("this.validAmount 2 : " + this.validAmount);

    //console.log("this.selectedToken: " + JSON.stringify(this.selectedToken))
    
    if(this.validAmount && this.selectedToken && this.selectedToken.currency === 'XAH') {
      this.validAmount = !(/[^.0-9]|\d*\.\d{7,}/.test(this.amountInput)) && parseFloat(this.amountInput) >= 0.000001;
      //console.log("this.validAmount 3 : " + this.validAmount);

      if(!this.validAmount) {
        this.maxSixDigits = this.amountInput.includes('.') && this.amountInput.split('.')[1].length > 6;
      } else {
        this.maxSixDigits = false;
      }
    } else {
      this.maxSixDigits = false;
    }
    
    this.validAddress = this.destinationInput && this.destinationInput.trim().length > 0 && isValidXRPAddress(this.destinationInput.trim());

    if((this.oldDestinationInput != this.destinationInput && this.validAddress) || userHasSignedInDestination || insertedDestinationAccount) {

      //dest acc has changed, check status
      this.destinationAccountExists = await this.checkIfDestinationAccountExists(this.destinationInput);

      if(this.destinationAccountExists) {

        await this.checkDestinationHasTrustline(this.destinationInput);

        //console.log("destinationHasTrustline: " + this.destinationHasTrustline);

        this.escrowDestinationSigned = userHasSignedInDestination;

        if(insertedDestinationAccount)
          this.snackBar.open("Destination address inserted", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
      } else {
        if(insertedDestinationAccount)
          this.snackBar.open("Account not existent on " + (this.testMode ? "TESTNET" : "MAINNET"), null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    } else {
      //destination acc might have changed and/or is not valid:
      if(this.oldDestinationInput != this.destinationInput) {
        this.escrowDestinationHasDestTagEnabled = false;
        this.escrowDestinationSigned = false;
      }
    }

    this.oldDestinationInput = this.destinationInput;


    this.validatingEscrow = true;

    this.isValidEscrow = true;
    //check some fields first
    if(!this.validAddress || !this.validAmount)
      this.isValidEscrow = false;

    if(this.isFinishAfterDateSet() && !this.finishafterTimeInput)
      this.isValidEscrow = false;

    if(this.finishafterTimeInput && !this.validFinishAfter)
      this.isValidEscrow = false;

    if(this.validFinishAfter && this.finishDateInFuture)
      this.isValidEscrow = false;

    if(this.isCancelAfterDateSet() && !this.cancelafterTimeInput)
      this.isValidEscrow = false;

    if(this.cancelafterTimeInput && !this.validCancelAfter)
      this.isValidEscrow = false;

    if(this.validCancelAfter && this.cancelDateInFuture)
      this.isValidEscrow = false;
      
    if(this.validFinishAfter && this.validCancelAfter && this.cancelDateBeforeFinishDate)
        this.isValidEscrow = false

    if(this.escrowYears > 10 && !this.checkBoxYears)
      this.isValidEscrow = false;

    if(!this.validFinishAfter && !this.validCancelAfter)
      this.isValidEscrow = false;

    this.validatingEscrow = false;

    //console.log("isValidEscrow: " + this.isValidEscrow);
  }

  isFinishAfterDateSet(): boolean {
    let date = new Date(this.finishAfterFormCtrl.value)
    return date != null && date.getTime() > 0;
  }

  isCancelAfterDateSet(): boolean {
    let date = new Date(this.cancelAfterFormCtrl.value)
    return date != null && date.getTime() > 0;
  }

  async resetFinishAfter() {
    this.finishAfterFormCtrl.reset();
    this.finishafterTimeInput = null;
    await this.checkChanges();
  }

  async resetCancelAfter() {
    this.cancelAfterFormCtrl.reset();
    this.cancelafterTimeInput = null;
    await this.checkChanges();
  }

  isValidDate(dateToParse: any): boolean {
    let datePicker = new Date(dateToParse);
    console.log(datePicker);
    return datePicker.getHours() >= 0;
  }

  async sendPayloadToXumm() {

    if(this.destinationTag)
      return;

    this.loadingData = true;
    //this.infoLabel = "sending payload";
    try {
      let xummPayload:XummTypes.XummPostPayloadBodyJson = {
        txjson: {
          TransactionType: "EscrowCreate",
          Account: this.originalAccountInfo.Account,
          NetworkID: this.testMode ? 21338 : 21337
        },
        options: {
          signers: [this.originalAccountInfo.Account],
          force_network: this.testMode ? this.force_xahau_test : this.force_xahau_main
        },
        custom_meta: {
          instruction: ""
        }
      }

      if(this.escrowYears > 10) {
        xummPayload.custom_meta.instruction += "ATTENTION: Your " + this.selectedToken.currencyShow + " will be inaccessible for " + this.escrowYears + "years!\n\n";
      }

      if(this.destinationInput && this.destinationInput.trim().length>0 && isValidXRPAddress(this.destinationInput)) {
        xummPayload.txjson.Destination = this.destinationInput.trim();
        xummPayload.custom_meta.instruction += "- Escrow Destination: " + this.destinationInput.trim();
      }
      
      if(this.amountInput && this.validAmount) {
        if(this.selectedToken && this.selectedToken.currency === 'XAH') {
          xummPayload.txjson.Amount = Math.round(parseFloat(this.amountInput)*1000000).toString();
        } else {
          xummPayload.txjson.Amount = {
            currency: this.selectedToken.currency,
            issuer: this.selectedToken.issuer,
            value: this.amountInput+""
          }
        } 
        
        xummPayload.custom_meta.instruction += "\n- Escrow Amount: " + this.amountInput + " " + this.selectedToken.currencyShow;
      }
  
      if(this.validCancelAfter) {
        xummPayload.txjson.CancelAfter = normalizer.utcToRippleEpocheTime(this.cancelAfterDateTime.getTime());
        xummPayload.custom_meta.instruction += "\n- Cancel After (UTC): " + this.cancelAfterDateTime.toUTCString();
      }

      if(this.validFinishAfter) {
        xummPayload.txjson.FinishAfter = normalizer.utcToRippleEpocheTime(this.finishAfterDateTime.getTime());
        xummPayload.custom_meta.instruction += "\n- Finish After (UTC): " + this.finishAfterDateTime.toUTCString();
      }

          
      let backendRequest: GenericBackendPostRequest = {
        options: {
          web: false,
          xrplAccount: this.originalAccountInfo.Account,
          pushDisabled: true
        },
        payload: xummPayload
      }

      let message = await this.waitForTransactionSigning(backendRequest);
      await this.handleEscrowCreateMessage(message);
      this.loadingData = false;

    } catch(err) {
      this.handleError(err);
      this.loadingData = false;
    }
  }

  async handleEscrowCreateMessage(message: any): Promise<void> {
    try {
      if(message && message.signed && message.payload_uuidv4) {            
        let transactionResult:TransactionValidation = null;
        //check if we are an EscrowReleaser payment
        transactionResult = await this.xummService.validateTransaction(message.payload_uuidv4);

        console.log("trx result: " + JSON.stringify(transactionResult));

        if(transactionResult && transactionResult.success) {
            this.snackBar.open("Escrow created!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
            await this.loadCreatedEscrowData(transactionResult.txid);
            this.moveNext();
        } else {
            this.snackBar.open("Escrow not created", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      } else {
        this.snackBar.open("Escrow not created", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    } catch(err) {
      this.handleError(err);
    }
  }

  async waitForTransactionSigning(payloadRequest: GenericBackendPostRequest): Promise<any> {
    this.loadingData = true;
    //this.infoLabel = "Opening sign request";
    let xummResponse:XummTypes.XummPostPayloadResponse;
    try {
        payloadRequest.payload.options = {
          expire: 2
        }

        if(payloadRequest.payload.txjson.Account) {
          payloadRequest.payload.options.signers = [payloadRequest.payload.txjson.Account+""];
        }

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

    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'openSignRequest',
        uuid: xummResponse.uuid
      }));
    }

    //this.infoLabel = "Showed sign request to user";
    //remove old websocket
    try {

      if(this.websocket && !this.websocket.closed) {
        this.websocket.unsubscribe();
        this.websocket.complete();
      }

      return new Promise( (resolve, reject) => {

        this.websocket = webSocket(xummResponse.refs.websocket_status);
        this.websocket.asObservable().subscribe(async message => {
            //console.log("message received: " + JSON.stringify(message));
            //this.infoLabel = "message received: " + JSON.stringify(message);

            if((message.payload_uuidv4 && message.payload_uuidv4 === xummResponse.uuid) || message.expired || message.expires_in_seconds <= 0) {

              if(this.websocket) {
                this.websocket.unsubscribe();
                this.websocket.complete();
              }
              
              return resolve(message);
            }
        });
      });
    } catch(err) {
      this.loadingData = false;
      //this.infoLabel = JSON.stringify(err);
    }
  }

  getAvailableXahBalance(): number {
    if(this.originalAccountInfo && this.originalAccountInfo.Balance) {
      let balance:number = Number(this.originalAccountInfo.Balance);
      balance = balance - this.accountReserve; //deduct acc reserve
      balance = balance - this.originalAccountInfo.OwnerCount * this.ownerReserve; //deduct owner count
      balance = balance - 1000; //deduct some transaction fee as quick fix
      balance = balance/1000000;

      console.log("AVAILABLE BALANCE: " + balance);

      if(balance >= 0.000001)
        return balance
      else
        return 0;
    } else {
      return 0;
    }
  }

  getAvailableXrpBalanceForEscrow(): number {
    if(this.originalAccountInfo && this.originalAccountInfo.Balance) {
      let balance:number = Number(this.originalAccountInfo.Balance);
      balance = balance - this.accountReserve; //deduct acc reserve
      balance = balance - this.originalAccountInfo.OwnerCount * this.ownerReserve; //deduct owner count
      balance = balance - this.ownerReserve; //deduct one owner reserve for the escrow
      balance = balance - 1000; //deduct some transaction fee as quick fix
      balance = balance/1000000;

      console.log("AVAILABLE BALANCE: " + balance);

      if(balance >= 0.000001)
        return balance
      else
        return 0;
    } else {
      return 0;
    }
  }

  getAvailableBalanceForEscrow(): number {
    if(this.selectedToken) {
      return this.selectedToken.balanceShow;
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
          signinToValidate: true,
          pushDisabled: true
      },
      payload: {
          txjson: {
              TransactionType: "SignIn"
          },
          custom_meta: {
            instruction: "Please choose your the account which should create the Escrow.\n\nSign the request to confirm.",
            blob: { source: "EscrowOwner"}
          }
      }
    }

    try {

      let message:any = await this.waitForTransactionSigning(backendPayload);

      if(message && message.payload_uuidv4 && message.signed) {
            
        let transactionResult:TransactionValidation = null;
        //check if we are an EscrowReleaser payment
        transactionResult = await this.xummService.checkSignIn(message.payload_uuidv4);

        if(transactionResult && transactionResult.success) {
          await this.loadAccountData(transactionResult.account);
          this.snackBar.open("Sign In successful", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        } else {
          this.snackBar.open("SignIn not successful!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      } else {
        this.snackBar.open("SignIn not successful!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  
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
    }
  }

  async handleOverlayEvent(event:any) {
    try {
      if(event && event.data) {
        let eventData = JSON.parse(event.data);

        if(eventData) {
          if(eventData.method == "scanQr") {
            this.infoLabel = "scanQR triggered" + JSON.stringify(eventData);

            if(eventData.reason == "SCANNED" && isValidXRPAddress(eventData.qrContents)) {
              this.destinationInput = eventData.qrContents;
              await this.checkChanges(true);
              this.loadingData = false;
            } else if(eventData.reason == "USER_CLOSE") {
              //do not do anything on user close
              this.loadingData = false;
            } else {
              this.destinationInput = null;
              this.snackBar.open("Invalid XRPL account", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
              await this.checkChanges();
              this.loadingData = false;
            }
          } else if(eventData.method == "payloadResolved" && eventData.reason == "DECLINED") {
            //user closed without signing
            this.loadingData = false;
          } else if(eventData.method == "selectDestination") {
            this.infoLabel = "selectDestination triggered: " + JSON.stringify(eventData);
            if(eventData.reason == "SELECTED" && isValidXRPAddress(eventData.destination.address)) {
              if(!eventData.info || (eventData.info && !eventData.info.blackHole && !eventData.info.disallowIncomingXRP && !eventData.info.possibleExchange && eventData.info.exist)) {
                //all good!
                this.destinationInput = eventData.destination.address;
                this.destinationTag = eventData.destination.tag;
                this.destinationName = eventData.destination.name;
                
                await this.checkChanges(true, true);
                
              } else if(eventData.info) {
                if(eventData.info.blackHole)
                  this.snackBar.open("You can not send an Escrow to a blackhole account.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
                else if(eventData.info.disallowIncomingXRP)
                  this.snackBar.open("The destination account wished to not receive XRP.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
                else if(eventData.info.possibleExchange)
                  this.snackBar.open("The destination account is possibly an Exchange. Please choose another account.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
                else if(!eventData.info.exist)
                  this.snackBar.open("The destination account does not exist on the " + (this.testMode ? "Testnet" : "Mainnet") + ".", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});

                this.destinationInput = null;
                this.destinationTag = null;
                this.destinationName = null;
                await this.checkChanges();
              }

              this.loadingData = false;
            } else if(eventData.reason == "USER_CLOSE") {
              //do not do anything on user close
              this.loadingData = false;
            } else {
              this.destinationInput = null;
              this.snackBar.open("Invalid XRPL account", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
              await this.checkChanges();
              this.loadingData = false;
            }
          }
        }
      }
    } catch(err) {
      //ignore error for now?
    }
  }

  async chooseDestinationFromXumm() {
    this.loadingData = true;
    if(this.xummMajorVersion >= 2 && this.xummMinorVersion >= 1) {
      //open new "destination selection" view
      await this.openDestinationSelectionView();
    } else {
      //do old "sign in" thing
      await this.signInForDestination();
    }
  }

  async openDestinationSelectionView() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'selectDestination'
      }));
    } else {
      await this.signInForDestination();
    }
  }

  async signInForDestination() {
    //this.infoLabel = "signInForDestination";
    this.loadingData = true;
    //setting up xumm payload and waiting for websocket
    let backendPayload:GenericBackendPostRequest = {
      options: {
          web: false,
          signinToValidate: true,
          pushDisabled: true
      },
      payload: {
          txjson: {
              TransactionType: "SignIn"
          },
          custom_meta: {
            instruction: "Please choose the Escrow Destination account. This is the account where the XRP are sent to once the Escrow is finished.\n\nSign the request to confirm.",
            blob: { source: "EscrowDestination"}
          }
      }
    }

    try {

      let message:any = await this.waitForTransactionSigning(backendPayload);

      if(message && message.payload_uuidv4 && message.signed) {
              
        let transactionResult:TransactionValidation = await this.xummService.checkSignIn(message.payload_uuidv4);

        if(transactionResult && transactionResult.success) {
          this.destinationInput = transactionResult.account;
          this.destinationName = null;
          this.destinationTag = null;
          this.snackBar.open("Destination account inserted!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
          await this.checkChanges(true, true);
        } else {
          this.snackBar.open("SignIn not successful!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      } else {
        this.snackBar.open("SignIn not successful!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  clearInputs() {
    this.destinationInput = this.amountInput = null;
    this.finishAfterFormCtrl.reset();
    this.cancelAfterFormCtrl.reset();
    this.cancelafterTimeInput = this.cancelAfterDateTime = null;
    this.finishafterTimeInput = this.finishAfterDateTime = null;

    this.cancelDateInFuture =  this.finishDateInFuture = this.cancelDateBeforeFinishDate = this.destinationHasTrustline = this.ownerHasBalanceForOwnerReserve = false;

    this.isValidEscrow = this.validAddress = this.validAmount = this.validCancelAfter = this.validFinishAfter = false;
  }

  async loadAccountData(xrplAccount: string) {
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount && isValidXRPAddress(xrplAccount)) {
      this.loadingData = true;

      //get connected node
      let server_info = { command: "server_info" };

      let serverInfoResponse = await this.xahauWebsocket.getWebsocketMessage("token-trasher", server_info, this.testMode);
      
      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xahauWebsocket.getWebsocketMessage("xrpl-transactions", account_info_request, this.testMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          this.originalAccountInfo = message_acc_info.result.account_data;

          if(this.getAvailableXahBalance() > 0.2) {
            this.ownerHasBalanceForOwnerReserve = true;
          } else {
            this.ownerHasBalanceForOwnerReserve = false;
          }
        } else {
          this.originalAccountInfo = message_acc_info;
        }
      } else {
        this.originalAccountInfo = "no account";
      }

      //load account lines
      let accountLinesCommand:any = {
        command: "account_objects",
        account: xrplAccount,
        type: "state",
        ledger_index: serverInfoResponse.result.info.validated_ledger.seq,
        limit: 200
      }

      //console.log("starting to read account lines!")

      let accountObjects = await this.xahauWebsocket.getWebsocketMessage('token-trasher', accountLinesCommand, this.testMode);
      
      if(accountObjects?.result?.account_objects) {
        let trustlines = accountObjects?.result?.account_objects;

        let marker = accountObjects.result.marker;

        console.log("marker: " + marker);
        console.log("LEDGER_INDEX : " + accountObjects.result.ledger_index);


        while(marker) {
            //console.log("marker: " + marker);
            accountLinesCommand.marker = marker;
            accountLinesCommand.ledger_index = accountObjects.result.ledger_index;

            //await this.xrplWebSocket.getWebsocketMessage("token-trasher", server_info, this.isTestMode);

            accountObjects = await this.xahauWebsocket.getWebsocketMessage('token-trasher', accountLinesCommand, this.testMode);

            marker = accountObjects?.result?.marker;

            if(accountObjects?.result?.account_objects) {
                trustlines = trustlines.concat(accountObjects.result.account_objects);
            } else {
                marker = null;
            }
        }

        //console.log("finished to read account lines!")

        this.existingAccountLines = trustlines;

        this.resetSimpleTrustlineList();

      } else {
        this.existingAccountLines = [];
      }

    } else {
      this.originalAccountInfo = "no account"
    }
  }

  async checkIfDestinationAccountExists(xrplAccount: string): Promise<boolean> {
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount) {
      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xahauWebsocket.getWebsocketMessage("xrpl-transactions", account_info_request, this.testMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          let accData:any = message_acc_info.result.account_data;

          if(accData.Flags)
            this.escrowDestinationHasDestTagEnabled = flagUtils.isRequireDestinationTagEnabled(accData.Flags);

          return Promise.resolve(accData.Account && isValidXRPAddress(accData.Account));
        } else {
          return Promise.resolve(false);
        }
      } else {
        return Promise.resolve(false);;
      }
    } else {
      return Promise.resolve(false);;
    }
  }

  async checkDestinationHasTrustline(destinationAccount:string): Promise<void> {
    try {

      if(this.selectedToken.currency === 'XAH' && this.selectedToken.issuer === 'XAH') {
        this.destinationHasTrustline = true;
      } else {

        //console.log("loading account data...");
        //this.infoLabel2 = "loading " + issuerAccount;
        if(destinationAccount && isValidXRPAddress(destinationAccount)) {
          this.loadingData = true;
          
          //load account lines
          let accountLinesCommand:any = {
            command: "account_objects",
            account: destinationAccount,
            type: "state",
            limit: 200
          }

          //console.log("starting to read account lines!")

          let accountObjects = await this.xahauWebsocket.getWebsocketMessage('token-trasher', accountLinesCommand, this.testMode);
          
          if(accountObjects?.result?.account_objects) {
            let trustlines:RippleState[] = accountObjects?.result?.account_objects;

            let marker = accountObjects.result.marker;

            //console.log("marker: " + marker);
            //console.log("LEDGER_INDEX : " + accountObjects.result.ledger_index);


            while(marker) {
                //console.log("marker: " + marker);
                accountLinesCommand.marker = marker;
                accountLinesCommand.ledger_index = accountObjects.result.ledger_index;

                //await this.xrplWebSocket.getWebsocketMessage("token-trasher", server_info, this.isTestMode);

                accountObjects = await this.xahauWebsocket.getWebsocketMessage('token-trasher', accountLinesCommand, this.testMode);

                marker = accountObjects?.result?.marker;

                if(accountObjects?.result?.account_objects) {
                    trustlines = trustlines.concat(accountObjects.result.account_objects);
                } else {
                    marker = null;
                }
            }

            //console.log("finished to read account lines!")
            let simpleTrustlines:SimpleTrustline[] = this.rippleStateToSimpleTrustline(destinationAccount, trustlines);

            //console.log("DESTINATION TRUSTLINES:")
            //console.log(JSON.stringify(simpleTrustlines));
            //console.log("SELECTED TOKEN: " + JSON.stringify(this.selectedToken));

            this.destinationHasTrustline = false;

            simpleTrustlines.forEach(trustline => {
              if(trustline.issuer === this.selectedToken.issuer && trustline.currency === this.selectedToken.currency && !trustline.isFrozen && trustline.balance < trustline.limit) {
                this.destinationHasTrustline = true;
                return;
              }
            });

          } else {
            this.destinationHasTrustline = false;
          }
        } else {
          this.destinationHasTrustline = false;
        }
      }
    } catch(err) {
      this.errorLabel = err;
      this.handleError(err);
    }
  }

  countsTowardsReserve(line: RippleState): boolean {
    const reserveFlag = line.HighLimit.issuer === this.originalAccountInfo.Account ? lsfHighReserve : lsfLowReserve;
    return line.Flags && (line.Flags & reserveFlag) == reserveFlag;
  }

  isFrozen(line: RippleState): boolean {
    const freezeFlag = line.HighLimit.issuer === this.originalAccountInfo.Account ? lsfLowFreeze : lsfHighFreeze;
    return line.Flags && (line.Flags & freezeFlag) == freezeFlag;
  }

  async loadIssuerAccountData(issuerAccount: string) {
    try {
      //console.log("loading account data...");
      //this.infoLabel2 = "loading " + issuerAccount;
      if(issuerAccount && isValidXRPAddress(issuerAccount)) {
        this.loadingData = true;
        
        let account_info_request:any = {
          command: "account_info",
          account: issuerAccount,
          "strict": true,
        }

        let accInfo:any = null;

        let message_acc_info:any = await this.xahauWebsocket.getWebsocketMessage("token-trasher", account_info_request, this.testMode);
        //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
        this.infoLabel = JSON.stringify(message_acc_info);
        if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
          if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
            accInfo = message_acc_info.result.account_data;

            this.issuerHasGlobalFreezeSet = flagUtils.isGlobalFreezeSet(accInfo.Flags);

            //console.log("issuer accInfo: " + JSON.stringify(accInfo));

            this.infoLabel = JSON.stringify(accInfo);

            //if account exists, check for already issued currencies
          } else {
            accInfo = message_acc_info;
          }
        } else {
          accInfo = "no account";
        }
      } else {

      }
    } catch(err) {
      this.errorLabel = err;
      this.handleError(err);
    }
  }

  applyFilter() {

    //console.log("search string: " + this.searchString);

    this.applyFilters = true;

    let newSimpleTrustlines:SimpleTrustline[] = this.rippleStateToSimpleTrustline(this.originalAccountInfo.Account, this.existingAccountLines);
    let filteredTrustlines:SimpleTrustline[] = [];

    for(let i = 0; i < newSimpleTrustlines.length; i++) {
      if(!this.searchString || this.searchString.trim().length == 0 || newSimpleTrustlines[i].currencyShow.toLocaleLowerCase().includes(this.searchString.trim().toLocaleLowerCase())) {
        filteredTrustlines.push(newSimpleTrustlines[i]);
      }
    }

    if(filteredTrustlines?.length > 0) {
      filteredTrustlines = filteredTrustlines.sort((a,b) => {
        return a.currencyShow.localeCompare(b.currencyShow);
      });
    }

    //add XAH in case it is available
    if(this.getAvailableXrpBalanceForEscrow() > 0) {
      filteredTrustlines = [{balance: this.getAvailableXrpBalanceForEscrow(), balanceShow: this.getAvailableXrpBalanceForEscrow(), currency: 'XAH', currencyShow: 'XAH', isFrozen: false, issuer: 'XAH', limit: 100000000, limitShow: 100000000, lockedBalance: 0}].concat(newSimpleTrustlines);
    }

    this.simpleTrustlines = filteredTrustlines;

    this.applyFilters = false;
  }

  resetSimpleTrustlineList() {
    this.applyFilters = true;

    let newSimpleTrustlines:SimpleTrustline[] = this.rippleStateToSimpleTrustline(this.originalAccountInfo.Account, this.existingAccountLines);

    if(newSimpleTrustlines?.length > 0) {
      newSimpleTrustlines = newSimpleTrustlines.sort((a,b) => {
        return a.currencyShow.localeCompare(b.currencyShow);
      });
    }

    //add XRP in case it is available
    if(this.getAvailableXrpBalanceForEscrow() > 0) {
      newSimpleTrustlines = [{balance: this.getAvailableXrpBalanceForEscrow(), balanceShow: this.getAvailableXrpBalanceForEscrow(), currency: 'XAH', currencyShow: 'XAH', isFrozen: false, issuer: 'XAH', limit: 100000000, limitShow: 100000000, lockedBalance: 0}].concat(newSimpleTrustlines);
    }

    this.simpleTrustlines = newSimpleTrustlines;    

    this.applyFilters = false;
  }

  rippleStateToSimpleTrustline(queryAccount:string, rippleStates: RippleState[]): SimpleTrustline[] {
    let newSimpleTrustlines:SimpleTrustline[] = []

    for(let i = 0; i < rippleStates.length; i++) {
      if(rippleStates[i] && this.countsTowardsReserve(rippleStates[i])) {
        let balance = Number(rippleStates[i].Balance.value);

        let lockedBalance = 0;

        if(rippleStates[i].LockedBalance) {
          lockedBalance = Number(rippleStates[i].LockedBalance.value);
        }

        let issuer:string = rippleStates[i].HighLimit.issuer === queryAccount ? rippleStates[i].LowLimit.issuer : rippleStates[i].HighLimit.issuer;
        let currency:string = rippleStates[i].Balance.currency;
        let currencyShow:string = normalizer.normalizeCurrencyCodeXummImpl(currency);
        let limit:number = Number(rippleStates[i].HighLimit.issuer === queryAccount ? rippleStates[i].HighLimit.value : rippleStates[i].LowLimit.value);

        if(balance < 0)
          balance = balance * -1;

        let balanceShow = normalizer.normalizeBalance(balance) - normalizer.normalizeBalance(lockedBalance);
        let limitShow = normalizer.normalizeBalance(limit);
        let isFrozen = this.isFrozen(rippleStates[i]);

        let foundObject = this.accountNames.filter(a => a.account === issuer);

        let name = null;

        if(foundObject && foundObject.length > 1) {
          name = foundObject[0].name;
        }

        newSimpleTrustlines.push({issuer: issuer, currency: currency, currencyShow: currencyShow, balance: balance, balanceShow: balanceShow, isFrozen: isFrozen, limit: limit, limitShow: limitShow, lockedBalance: lockedBalance, name: name});
      }
    }

    return newSimpleTrustlines;
  }

  async selectToken(token: SimpleTrustline) {
    this.loadingData = true;
    try {
      this.moveNext();

      this.resetVariables();

      //console.log("SELECTED: " + JSON.stringify(token));
      this.selectedToken = token;
      this.searchString = null;

      //loading issuer data
      await this.loadIssuerAccountData(this.selectedToken.issuer);

      if(this.selectedToken.balance > 0) {
        
      }

    } catch(err) {
      console.log("ERROR SELECTING TOKEN");
      console.log(JSON.stringify(err));
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async loadCreatedEscrowData(txId: string): Promise<void> {
    this.loadingData = true;
    let txInfo:any = {
        command: "tx",
        transaction: txId,
    }

    let message:any = await this.xahauWebsocket.getWebsocketMessage("escrowListExecuter", txInfo, this.testMode);

    //this.infoLabel = JSON.stringify(message);

    if(message && message.status && message.status === 'success' && message.type && message.type === 'response') {
        if(message.result && message.result.TransactionType === 'EscrowCreate') {
            //console.log("Sequence: " + message.result.Sequence);
            this.createdEscrow = message.result;
            //this.infoLabel = JSON.stringify(this.createdEscrow);
        }
    }
  }

  async addEscrowToAutoReleaser() {
    this.loadingData = true;
    let genericBackendRequest:GenericBackendPostRequest = {
        options: {
            xrplAccount: this.createdEscrow.Account,
            pushDisabled: true
        },
        payload: {
          txjson: {
              TransactionType: "Payment",
              Account: this.createdEscrow.Account,
              Memos : [{Memo: {MemoType: Buffer.from("[https://xahau.services]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for Auto Release of Escrow via xApp! Owner:" + this.createdEscrow.Account + " Sequence: " + this.createdEscrow.Sequence, 'utf8').toString('hex').toUpperCase()}}],
              NetworkID: this.testMode ? 21338 : 21337
          },
          custom_meta: {
              instruction: "SIGN WITH ESCROW OWNER ACCOUNT!!!\n\nEnable Auto Release for Escrow!\n\nEscrow-Owner: " + this.createdEscrow.Account + "\nSequence: " + this.createdEscrow.Sequence + "\nFinishAfter: " + new Date(normalizer.rippleEpocheTimeToUTC(this.createdEscrow.FinishAfter)).toLocaleString(),
              blob: {account: this.createdEscrow.Account, sequence: this.createdEscrow.Sequence, finishafter: normalizer.rippleEpocheTimeToUTC(this.createdEscrow.FinishAfter), testnet: this.testMode, purpose: "Escrow Finish Service"}
          },
        }
    }

    try {

      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4 && message.signed) {
        let transactionResult:TransactionValidation = await this.xummService.validateEscrowPayment(message.payload_uuidv4);

        if(transactionResult && transactionResult.success) {
          this.snackBar.open("Auto Release activated!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
          this.autoReleaseActivated = true;
        } else {
            if(transactionResult && transactionResult.message)
              this.snackBar.open(transactionResult.message, null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
            else
              this.snackBar.open("Auto Release NOT activated!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});

            this.autoReleaseActivated = false;
        }
      } else {
        this.snackBar.open("Auto Release NOT activated!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        this.autoReleaseActivated = false;
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
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

        if(expectedRelease.getMinutes() >= 4 && expectedRelease.getMinutes() <= 59)
          expectedRelease.setHours(expectedRelease.getHours()+1);

        expectedRelease.setMinutes(5,0,0);
        return expectedRelease.toLocaleString();
    } else
        return "-";
  }

  async loadAccountNames() {
    try {
      let wellKnown = await this.appService.get("https://api.xahscan.com/api/v1/names/well-known");

      if(wellKnown?.length > 0) {
        this.accountNames = wellKnown;
      }
    } catch(err) {
      console.log(err);
    }
  }

  openTermsAndConditions() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xahau.services/terms"
      }));
    }
  }

  openPrivacyPolicy() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xahau.services/privacy"
      }));
    }
  }

  close() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'close',
        refreshEvents: 'true'
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

  scrollToTop() {
    window.scrollTo(0, 0);
  }

  handleError(err) {
    if(err && JSON.stringify(err).length > 2) {
      this.errorLabel = JSON.stringify(err);
      this.scrollToTop();
    }
    this.snackBar.open("Error occured. Please try again!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
  }

  copyError() {
    if(this.errorLabel) {
      clipboard(this.errorLabel);
      this.snackBar.dismiss();
      this.snackBar.open("Error text copied to clipboard!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
    }
  }

  resetVariables() {
    this.selectedToken = this.searchString = null;
    this.issuerHasGlobalFreezeSet = false;
    this.resetSimpleTrustlineList();
  }
}
