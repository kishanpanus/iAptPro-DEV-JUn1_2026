import { CommonModule, NgClass } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mobile-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mobile-login.component.html',
  styleUrl: './mobile-login.component.css'
})
export class MobileLoginComponent implements OnInit {
  isMenuOpen = false;
  constructor(private router: Router) {}

  ngOnInit(): void {
    //this.router.navigate(['/login']);
  }
  toggleMobileMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }
  
  closeMenu() {
    this.isMenuOpen = false;
  }
  
}
