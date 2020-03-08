import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { AuthenticationService, UserDetails } from '../authentication.service';
import { UUID } from 'angular2-uuid';

import { SensorDataService } from '../sensor-data.service';
import { DeviceManager } from '../device-manager.service';
import { DeviceModel } from '../models/device-model';

import { ChartDataSets, ChartOptions, ChartType } from 'chart.js';
import { Color, BaseChartDirective, Label } from 'ng2-charts';
import * as pluginAnnotations from 'chartjs-plugin-annotation';

import { OnlineOfflineService } from '../online-offline.service';

@Component({
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  details: UserDetails;
  application: string;
  syncTimestamp: string;
  onlineOffline: string = 'Online'; // assume app is online initially to load

  schedule: string[] = [];
  forecastSummary: {summary: string, percipProb: string, humidity: string}[] = [];

  devices: DeviceModel[] = []; 
  alerts: {}[] = [];

  constructor(
  private readonly onlineOfflineService: OnlineOfflineService,
    private auth: AuthenticationService, 
    private sensor: SensorDataService, 
    public dm: DeviceManager, 
    private router: Router) {

    this.registerToEvents(onlineOfflineService);

    }
  
  ngOnInit() {

    this.auth.profile().subscribe(user => {
      this.details = user;

      // need check to see if device manager is empty if empty pull from db and update device manager
      this.dm.setDeviceList(this.details.devices);
      this.devices = this.details.devices;

      var deviceListAsString = [];
      for(var i = 0; i < this.devices.length; i++){
        deviceListAsString.push(this.devices[i].title);
      }

      // initial base sync...
      this.sensor.withdrawData(deviceListAsString, 0, Date.now(), 1)
        .subscribe(snapshot => {

        this.application = snapshot.data[0].applicationName;  // assuming all data comes from the same application
        this.syncTimestamp = (new Date()).toString()
      });

      console.log(this.auth.getToken());
    }, (err) => {
      console.error(err);
    });

    this.sensor.withdrawForecast().subscribe(snapshot => {
      if(snapshot.data.alerts != null){
        this.alerts = snapshot.data.alerts;
      }

      for(var i = 0; i < snapshot.data.daily.data.length; i++){
        var d = new Date(0);
        d.setUTCSeconds(snapshot.data.daily.data[i].time);

        this.schedule.push(d.toString());
        this.forecastSummary.push({
          summary: snapshot.data.daily.data[i].summary,
          percipProb: (snapshot.data.daily.data[i].precipProbability * 100).toFixed(0),
          humidity: (snapshot.data.daily.data[i].humidity * 100).toFixed(0)
        });
      }
    })
  }

  private registerToEvents(onlineOfflineService: OnlineOfflineService) {
    onlineOfflineService.connectionChanged.subscribe(online => {

      if (online) {
        this.onlineOffline = 'Online';
      } else {
        this.onlineOffline = 'Offline';
      }
    });
  }
}
