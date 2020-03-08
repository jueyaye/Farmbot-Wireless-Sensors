import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators/map';

import { AuthenticationService, TokenPayload, TokenResponse } from './authentication.service';

export interface LiveData {
  applicationName: String,
  deviceName: String,
  timestamp: Number,
  data: {
    temp: Number,
    lux: Number,
    moist: Number,
    cond: Number,
  },
  forecast: {
    main: String,
    percipIntensity: Number,
    percipProbability: Number,
    windGust: Number,
    cloudCover: Number,
    uvIndex: Number
  }
}

@Injectable()
export class SensorDataService {

  constructor(
    private http: HttpClient,
    private auth: AuthenticationService) {}


  private request(method: 'post'|'get', type: String): Observable<any> {
    let base;

    if (method === 'post') {
      base = this.http.post(`/api/${type}`, { headers: { Authorization: `Bearer ${this.auth.getToken()}` }});
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

  public withdrawData(devices: string[], timestampFrom: number, timestampTill: number, limit: number): Observable<any> {

    var devicesAsString = devices[0];
    for(var i = 1; i < devices.length; i++){
      devicesAsString += (',' + devices[i]);
    }

    return this.request('get', 'withdraw/data?devices=' + devicesAsString + '&timestampFrom=' 
      + timestampFrom + '&timestampTill=' + timestampTill + '&limit=' + limit);
  }

  public withdrawPrediction(device): Observable<any> {
    return this.request('get', 'withdraw/prediction/?devices=' + device);
  }

  public withdrawForecast(): Observable<any> {
    return this.request('get', 'withdraw/forecast');
  }
}
