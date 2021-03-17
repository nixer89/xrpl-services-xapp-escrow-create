import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { XummService } from './services/xumm.service';
import { OverlayContainer } from '@angular/cdk/overlay';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'xumm-xapp-escrow-create';
  darkMode:boolean = true;
  receivedParams = false;
  alreadySent = false;

  infoLabel:string = null;

  ottReceived: Subject<any> = new Subject<any>();

  timeout1: any;
  timeout2: any;

  constructor(private route: ActivatedRoute, private xummService: XummService, private overlayContainer: OverlayContainer) { }

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      if(this.timeout1) {
        //console.log("clearing timeout1");
        clearTimeout(this.timeout1)
      }
  
      if(this.timeout2) {
        //console.log("clearing timeout2");
        clearTimeout(this.timeout2)
      }

      let xAppToken = params.xAppToken;
      let xAppStyle = params.xAppStyle;

      this.receivedParams = !(xAppToken == null && xAppStyle == null);
      //console.log("has params received: " + this.receivedParams)

      //console.log("received pararms: " + JSON.stringify(params));
      this.infoLabel = "params: " + JSON.stringify(params);

      this.darkMode = xAppStyle && xAppStyle != 'LIGHT';

      var bodyStyles = document.body.style;
      if(!this.darkMode) {
        //console.log("setting light style app");
        bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
        this.overlayContainer.getContainerElement().classList.remove('dark-theme');
        this.overlayContainer.getContainerElement().classList.add('light-theme');
      } else {
        //console.log("setting dark style app");
        bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
        this.overlayContainer.getContainerElement().classList.remove('light-theme');
        this.overlayContainer.getContainerElement().classList.add('dark-theme');
      }

      if(xAppToken) {
        let ottResponse:any = await this.xummService.getxAppOTTData(xAppToken);
        //console.log("ottResponse: " + JSON.stringify(ottResponse));

        this.alreadySent = true;

        if(ottResponse && ottResponse.error) {
          //console.log("error OTT, only sending app style");
          this.ottReceived.next({style: xAppStyle});
        } else {
          this.ottReceived.next(ottResponse);
          this.alreadySent = true;
        }      
      } else {
        //didn't got an ott. Just send over the app style (even if not available)
        this.timeout1 = setTimeout(() => {
          //console.log("checking with: " + this.receivedParams);
          if(this.receivedParams && !this.alreadySent) {
            //console.log("only received appstyle")
            this.ottReceived.next({style: xAppStyle});
            this.alreadySent = true;
          }
        }, 1000);
      }
    });

    this.timeout2 = setTimeout(() => {
      //console.log("checking with2: " + this.receivedParams);
      if(!this.receivedParams && !this.alreadySent) {
        //console.log("didnt received any params")
        this.ottReceived.next({style: null});
        this.alreadySent = true;
      }
    }, 3000);
  }
}
