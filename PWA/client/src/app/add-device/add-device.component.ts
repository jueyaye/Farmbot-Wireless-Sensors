import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup,  FormBuilder,  Validators } from '@angular/forms';
import { DeviceManager } from '../device-manager.service'

@Component({
  templateUrl: './add-device.component.html'
})
export class AddDeviceComponent implements OnInit {

  angForm: FormGroup;
  constructor(private fb: FormBuilder, private dm: DeviceManager, private router: Router) {
    this.createForm();
  }

  createForm() {
    this.angForm = this.fb.group({
      title: ['', Validators.required ],
      bda: ['', Validators.required ],
      description: ['', Validators.required ],
      lat: ['', Validators.required ],
      lng: ['', Validators.required ]
    });
  }

  addDevice(title, bda, description, lat, lng) {
    this.dm.addDevice(title, bda, description, {lat: lat, lng: lng});
    this.router.navigate(['/profile']);
  }

  ngOnInit() {
  }

}
