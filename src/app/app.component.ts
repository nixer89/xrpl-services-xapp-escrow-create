import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'xumm-xapp-escrow-create';
  darkMode:boolean = true;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      let xAppStyle = params.xAppStyle;

      console.log("received pararms: " + JSON.stringify(params));

      var bodyStyles = document.body.style;
      if('LIGHT' == xAppStyle) {
        console.log("setting light style");
        this.darkMode = false;
        bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
      } else {
        console.log("setting dark style");
        this.darkMode = true;
        bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
      }
    });
  }
}
