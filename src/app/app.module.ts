import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from '@angular/flex-layout';

//my modules
import { FooterComponent } from './footer';
import { EscrowCreateComponentXahau } from './escrowcreateXahau';
import { EscrowCreateComponentXrpl} from './escrowcreateXrpl';
import { AppService } from './services/app.service';
import { XahauServices } from './services/xahau.services';
import { XahauWebsocket } from './services/xahauWebSocket';
import { XrplServices } from './services/xrpl.services';
import { XRPLWebsocket } from './services/xrplWebSocket';

//Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [
    AppComponent,
    FooterComponent,
    EscrowCreateComponentXahau,
    EscrowCreateComponentXrpl
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    RouterModule.forRoot([]),
    FlexLayoutModule,
    MatCardModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatStepperModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatCheckboxModule,
    MatToolbarModule
  ],
  providers: [
    AppService,
    XahauServices,
    XahauWebsocket,
    XrplServices,
    XRPLWebsocket,
    MatMomentDateModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
