import { Component } from '@angular/core';

@Component({
  selector: 'app-charges',
  imports: [],
  templateUrl: './charges.component.html',
  styleUrl: './charges.component.css',
})
export class ChargesComponent {
  charges = [
    { type: 'Maintenance', amount: 2500, status: 'Paid' },
    { type: 'Water Bill', amount: 600, status: 'Unpaid' },
    { type: 'Penalty', amount: 200, status: 'Unpaid' }
  ];

  get totalDue(): number {
    return this.charges
      .filter(c => c.status === 'Unpaid')
      .reduce((sum, c) => sum + c.amount, 0);
  }
}
