import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { XummService } from './services/xumm.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'xumm-xapp-escrow-create';
  darkMode:boolean = true;

  ottLoaded:Promise<boolean>;
  infoLabel:string = null;

  ottReceived: Subject<any> = new Subject<any>();

  constructor(private route: ActivatedRoute, private xummService: XummService) {
    this.route.queryParams.subscribe(async params => {
      let xAppToken = params.xAppToken;
      let xAppStyle = params.xAppStyle;

      console.log("received pararms: " + JSON.stringify(params));
      this.infoLabel = "params: " + JSON.stringify(params);

      this.darkMode = xAppStyle && xAppStyle != 'LIGHT';

      var bodyStyles = document.body.style;
      if(!this.darkMode) {
        console.log("setting light style");
        bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
      } else {
        console.log("setting dark style");
        bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
      }

      if(xAppToken) {
        let ottResponse:any = await this.xummService.getxAppOTTData(xAppToken);

        // getxAppOTT response: {"version":"1.0.9","locale":"en","style":"LIGHT","nodetype":"TESTNET","origin":{"type":"QR"}}

        let newMode = ottResponse && ottResponse.style && ottResponse.style != 'LIGHT';

        if(this.darkMode != newMode) {
          this.darkMode = newMode;

          var bodyStyles = document.body.style;
          if(!this.darkMode) {
            console.log("setting light style");
            bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
          } else {
            console.log("setting dark style");
            bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
          }
        }

        this.ottReceived.next(ottResponse);
      }

      this.ottLoaded = Promise.resolve(true);
    });
  }

  ngOnInit() {
    
  }
}
