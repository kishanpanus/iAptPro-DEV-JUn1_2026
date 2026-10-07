import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-enrollment-success',
  templateUrl: './enrollment-success.component.html',
  styleUrls: ['./enrollment-success.component.css']
})
export class EnrollmentSuccessComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit(): void {
    // setTimeout(() => {
    //   this.router.navigate(['/']);
    // }, 5000); 
  }

  goToLogin() {
    this.router.navigate(['/']);

  }
}
