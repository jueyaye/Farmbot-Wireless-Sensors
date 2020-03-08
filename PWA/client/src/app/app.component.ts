import { Component } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { DeviceManager } from './device-manager.service'
import { DeviceModel } from './models/device-model'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent {
	devices: DeviceModel[] = [];

  constructor(
  	public auth: AuthenticationService,
    public dm: DeviceManager 
  ) {}

  ngOnInit(){
    this.dm.devicesChange.subscribe(value => {
      this.devices = value;
    });

  }
}
