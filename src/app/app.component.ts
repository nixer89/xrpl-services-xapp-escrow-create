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
  themeClass:string = "dark-theme";
  backgroundColor: string = "#000000";

  infoLabel:string = null;

  ottReceived: Subject<any> = new Subject<any>();

  constructor(private route: ActivatedRoute, private xummService: XummService, private overlayContainer: OverlayContainer) { }

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      let xAppToken = params.xAppToken;
      let xAppStyle = params.xAppStyle;

      console.log("received pararms: " + JSON.stringify(params));
      this.infoLabel = "params: " + JSON.stringify(params);

      if(xAppStyle) {
        switch(xAppStyle) {
          case 'LIGHT':
            this.themeClass = 'light-theme';
            this.backgroundColor = '#FFFFFF';
            break;
          case 'DARK':
            this.themeClass = 'dark-theme';
            this.backgroundColor = '#000000';
            break;
          case 'MOONLIGHT':
            this.themeClass = 'moonlight-theme';
            this.backgroundColor = '#181A21';
            break;
          case 'ROYAL':
            this.themeClass = 'royal-theme';
            this.backgroundColor = '#030B36';
            break;
          default:
            this.themeClass = 'dark-theme';
            this.backgroundColor = '#000000';
            break;
        }
      }

      var bodyStyles = document.body.style;
      console.log("setting style :" + this.themeClass);
      bodyStyles.setProperty('--background-color', this.backgroundColor);
      this.overlayContainer.getContainerElement().classList.remove('dark-theme');
      this.overlayContainer.getContainerElement().classList.remove('light-theme');
      this.overlayContainer.getContainerElement().classList.remove('moonlight-theme');
      this.overlayContainer.getContainerElement().classList.remove('royal-theme');
      this.overlayContainer.getContainerElement().classList.add(this.themeClass);

      if(xAppToken) {
        let ottResponse:any = await this.xummService.getxAppOTTData(xAppToken);

        this.ottReceived.next(ottResponse);
      }
    });
  }
}
