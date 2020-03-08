import { Injectable } from '@angular/core';
import { UUID } from 'angular2-uuid';
import { Subject } from 'rxjs/Subject';

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators/map';
import { AuthenticationService, TokenPayload, TokenResponse } from './authentication.service';

import { DeviceModel } from './models/device-model';
import { SensorDataModel } from './models/sensor-data-model';
import { OnlineOfflineService } from './online-offline.service';

@Injectable({ providedIn: 'root' })
export class DeviceManager {
  public dataArray: SensorDataModel[] = [];
  public db: any;


  devicesChange: Subject<DeviceModel[]> = new Subject<DeviceModel[]>();
  public deviceList: DeviceModel[] = [];

  constructor(
    private readonly onlineOfflineService: OnlineOfflineService,
    private http: HttpClient,
    private auth: AuthenticationService) {

    this.devicesChange.subscribe((value) => {
      this.deviceList = value;
    });
  }

  public setDeviceList(devices){
    this.devicesChange.next(devices);
  }

  private request(method: 'post'|'get', type: String, body?: DeviceModel): Observable<any> {
    let base;

    if (method === 'post') {
      base = this.http.post(`/api/${type}`, body, { headers: { Authorization: `Bearer ${this.auth.getToken()}` }});
    } else {
      base = this.http.get(`/api/${type}`, { headers: { Authorization: `Bearer ${this.auth.getToken()}` }});
    }

    const request = base.pipe(
      map((data: TokenResponse) => {
        if (data.token) {
          this.auth.saveToken(data.token);
        }
        return data;
      })
    );

    return request;
  }

  public addDevice(title: string, bda: string, description: string, location: {lat: string, lng: string}) {
    var newDevice = {
      title: title, 
      bda: bda,
      description: description, 
      location: location
    };
      
    this.request('post', 'add/devicedata', newDevice).subscribe((snapshot) => {
      console.log(snapshot);
    });
  }

  public addData(temp: number, lux: number, moist: number, cond: number, timestamp: number){
    var dbEntry = {
      id: UUID.UUID(),
      temp: temp, 
      lux: lux, 
      moist: moist,
      cond: cond,
      timestamp: timestamp
    }

    this.dataArray.push(dbEntry);
  }
}