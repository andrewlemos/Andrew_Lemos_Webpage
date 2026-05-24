import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function listProducts() {
  console.log("Fetching products...");
  const querySnapshot = await getDocs(collection(db, 'products'));
  querySnapshot.forEach((doc) => {
    console.log(`ID: ${doc.id}`);
    console.log(`Name: ${doc.data().name}`);
    console.log(`Image URL: ${doc.data().imageUrl}`);
    console.log(`Affiliate Link: ${doc.data().affiliateLink}`);
    console.log('---');
  });
}

listProducts().catch(console.error);
