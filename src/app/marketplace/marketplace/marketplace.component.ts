import { Component, EventEmitter, input, Input, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc } from '@angular/fire/firestore';
import { ModalService } from '../../services/services/model.service';

interface MarketplaceItem {
  id?: string;
  title: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  contact?: string;
  apartmentId?: string;
  postedBy?: string;
  status?: string;
  category?: string; 
  timestamp?: string;
  name: string
}


@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.css']
})
export class MarketplaceComponent {
  @Input() apartmentId: string | null = null;
  @Input() postedBy: string | null = null;
  @Input() name: string | null = null;

  listings: MarketplaceItem[] = [];

  newItem: MarketplaceItem = {
    id: '',
    title: '',
    description: '',
    category: '',
    price: undefined,
    contact: '',
    apartmentId: '',
    postedBy: '',
    status: 'active',
    name: ''
  };
  loadedItems: any[] = [];

  categories = ['Furniture', 'Electronics', 'Books', 'Others'];

  constructor(private firestore: Firestore, private modalService: ModalService) {}
  @Output() itemsLoaded = new EventEmitter<any[]>();
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['apartmentId'] && this.apartmentId) {
      this.loadListings(this.apartmentId);
    }
  }

  openChat(item: any) {
    const phone = item.contact?.replace(/[^0-9]/g, ''); 
    const message = encodeURIComponent(`Hi, I'm interested in your item "${item.title}" listed in the Apt3M Marketplace.`);
    const whatsappUrl = `https://wa.me/91${phone}?text=${message}`;
  
    window.open(whatsappUrl, '_blank');
  }
  

  async loadListings(apartmentId: string) {
    const snapshot = await getDocs(query(
      collection(this.firestore, 'marketplaceListings'),
      where('apartmentId', '==', apartmentId),
      where('status', '==', 'active')
    ));
    this.listings = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as MarketplaceItem) }));
    this.itemsLoaded.emit(this.loadedItems);
  }

  async postItem() {

    this.newItem.apartmentId = this.apartmentId!;
  this.newItem.postedBy = this.postedBy!;
  this.newItem.contact = this.postedBy!; 
  
    if (!this.newItem.title || !this.newItem.price || !this.newItem.contact || !this.apartmentId || !this.postedBy) {
      this.modalService.show('❗ Please fill all required fields','info');
      return;
    }
  
    this.newItem.timestamp = new Date().toISOString();
    this.newItem.apartmentId = this.apartmentId;
    this.newItem.postedBy = this.postedBy;
  
    const docRef = await addDoc(collection(this.firestore, 'marketplaceListings'), this.newItem);
  
    // ✅ Set the generated ID into the document
    await updateDoc(docRef, { id: docRef.id });
  
    this.modalService.show('✅ Item posted!','success');
    this.newItem = {
      title: '',
      description: '',
      category: '',
      price: undefined,
      contact: '',
      apartmentId: '',
      postedBy: '',
      status: 'active',
      name :''
    };
  
    await this.loadListings(this.apartmentId!);
  }
  
  resetForm() {
    this.newItem = {
      title: '',
      description: '',
      category: '',
      price: undefined,
      contact: '',
      apartmentId: this.apartmentId || '',
      postedBy: this.postedBy || '',
      status: 'active',
      name: ''
    };
  }
  
  

  async markAsSold(listingId: string) {
    if (!listingId) {
      console.error('Missing listing ID');
      return;
    }
    const listingRef = doc(this.firestore, 'marketplaceListings', listingId);
    await updateDoc(listingRef, { status: 'sold' });
    if (this.apartmentId) await this.loadListings(this.apartmentId);
  }

  async deleteListing(listingId: string) {
    const listingRef = doc(this.firestore, 'marketplaceListings', listingId);
    await deleteDoc(listingRef);
    if (this.apartmentId) await this.loadListings(this.apartmentId);
  }
}
