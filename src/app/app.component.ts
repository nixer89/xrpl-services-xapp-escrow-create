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

  ottLoaded:Promise<boolean>;
  infoLabel:string = null;

  ottReceived: Subject<any> = new Subject<any>();

  constructor(private route: ActivatedRoute, private xummService: XummService, private overlayContainer: OverlayContainer) { }

  ngOnInit() {
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
        this.overlayContainer.getContainerElement().classList.remove('dark-theme');
        this.overlayContainer.getContainerElement().classList.add('light-theme');
      } else {
        console.log("setting dark style");
        bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
        this.overlayContainer.getContainerElement().classList.remove('light-theme');
        this.overlayContainer.getContainerElement().classList.add('dark-theme');
      }

      if(xAppToken) {
        let ottResponse:any = await this.xummService.getxAppOTTData(xAppToken);

        this.ottLoaded = Promise.resolve(true);

        setTimeout(() => {this.ottReceived.next(ottResponse);} , 200);     
      }
    });
  }
}
