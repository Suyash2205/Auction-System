import type { PlayerCategory } from "@/lib/types";

export type Lpl4ListedPlayer = {
  id: string;
  name: string;
  category: PlayerCategory;
  /** Exact registered name in the player database, when confirmed. */
  dbName?: string;
  isOwner?: boolean;
};

/**
 * LPL 4 screen-share list — 60 players (F1 10 · M1 10 · M2 10 · M3 10 · M4 20).
 * Sheet order follows organiser PDF. DB names confirmed by organiser.
 */
export const lpl4Players: Lpl4ListedPlayer[] = [
  // F1 — 10
  { id: "f1-1", name: "Vaidehi Walse", category: "F1", dbName: "Vaidehi Walse" },
  { id: "f1-2", name: "Pallavi Kotian", category: "F1" },
  { id: "f1-3", name: "Pierangela john", category: "F1", dbName: "Pierangela John" },
  { id: "f1-4", name: "Babita Saini", category: "F1" },
  { id: "f1-5", name: "Kavita Khanna", category: "F1" },
  { id: "f1-6", name: "Alisha", category: "F1", dbName: "Alisha" },
  { id: "f1-7", name: "Ms Saroj Mayadev", category: "F1" },
  { id: "f1-8", name: "Wilma", category: "F1", dbName: "Wilma Mascarenhas" },
  { id: "f1-9", name: "Aakanksha", category: "F1", isOwner: true },
  { id: "f1-10", name: "Vaidehi Rajpathak", category: "F1", dbName: "Vaidehi Rajpathak" },

  // M1 — 10
  { id: "m1-1", name: "Samrat Kapur", category: "M1", dbName: "SAMRATSAURABH KAPUR" },
  { id: "m1-2", name: "Kunal More", category: "M1", dbName: "Kunal More" },
  { id: "m1-3", name: "Srijith Shivan", category: "M1", dbName: "Srijith Shivan" },
  { id: "m1-4", name: "Viraj Bhayani", category: "M1" },
  { id: "m1-5", name: "Dharmendra Bhurji", category: "M1" },
  { id: "m1-6", name: "Aditya Dcosta", category: "M1" },
  { id: "m1-7", name: "Nilesh Makwana", category: "M1" },
  { id: "m1-8", name: "Gaurav Kumar", category: "M1" },
  { id: "m1-9", name: "Kartik Juneja", category: "M1", isOwner: true },
  { id: "m1-10", name: "Swayam Mozar", category: "M1", dbName: "Swayam Mozar", isOwner: true },

  // M2 — 10
  { id: "m2-1", name: "ARVIND PAWAR", category: "M2", dbName: "Arvind pawar" },
  { id: "m2-2", name: "Sahil Gadhiya", category: "M2", dbName: "Sahil Gadhiya" },
  { id: "m2-3", name: "CHETAN JOSHI", category: "M2", dbName: "Chetan joshi" },
  { id: "m2-4", name: "Ujwal Chopra", category: "M2", dbName: "Ujwal Chopra" },
  { id: "m2-5", name: "Jay shah", category: "M2", dbName: "Jay Shah", isOwner: true },
  { id: "m2-6", name: "Prashant Rawool", category: "M2", dbName: "PRASHANT RAWOOL" },
  { id: "m2-7", name: "Rahim dossa", category: "M2" },
  { id: "m2-8", name: "Manish M10", category: "M2", isOwner: true },
  { id: "m2-9", name: "Kwo Pou Chang", category: "M2", dbName: "Kwo pou chang" },
  { id: "m2-10", name: "Faisal", category: "M2" },

  // M3 — 10
  { id: "m3-1", name: "DR.ROOPESH SINGH", category: "M3" },
  { id: "m3-2", name: "Tabrej", category: "M3" },
  { id: "m3-3", name: "Dhaval A Shah", category: "M3", dbName: "Dhaval A shah" },
  { id: "m3-4", name: "Viki rajani", category: "M3", dbName: "Viki Rajani" },
  { id: "m3-5", name: "Anand Haritwal", category: "M3" },
  { id: "m3-6", name: "Ace", category: "M3", dbName: "Ace" },
  { id: "m3-7", name: "Sonesh Shukla", category: "M3", dbName: "SONESH SHUKLA", isOwner: true },
  { id: "m3-8", name: "Vijay Mozar", category: "M3", dbName: "Vijay Mozar" },
  { id: "m3-9", name: "Surjit Parvi", category: "M3", isOwner: true },
  { id: "m3-10", name: "Chris", category: "M3", dbName: "Chris Gracias" },

  // M4 — 20
  { id: "m4-1", name: "Kushal maru", category: "M4", dbName: "Kushal maru" },
  { id: "m4-2", name: "Praseem Shah", category: "M4", dbName: "Praseem Shah" },
  { id: "m4-3", name: "Uday Shetty", category: "M4" },
  { id: "m4-4", name: "Sandeep Raulo", category: "M4", dbName: "Sandeep Raulo" },
  { id: "m4-5", name: "Sandesh Mishra", category: "M4" },
  { id: "m4-6", name: "Haans Kapur", category: "M4" },
  { id: "m4-7", name: "Hemant Joshi", category: "M4" },
  { id: "m4-8", name: "Vrutik Ramavat", category: "M4", dbName: "Vrutik Ramavat" },
  { id: "m4-9", name: "Vinu Sahadevan", category: "M4", dbName: "Vinu Sahadevan" },
  { id: "m4-10", name: "Nawaz Dalwai", category: "M4", dbName: "Nawaz Dalwai" },
  { id: "m4-11", name: "Adil Lakhani", category: "M4" },
  { id: "m4-12", name: "BUNTY GAUR", category: "M4", dbName: "Bunty gaur" },
  { id: "m4-13", name: "Chitransh", category: "M4", dbName: "Chitransh" },
  { id: "m4-14", name: "Ronal Dsouza", category: "M4", dbName: "Ronal Dsouza" },
  { id: "m4-15", name: "Mitul Sonani", category: "M4", dbName: "Mitul Sonani" },
  { id: "m4-16", name: "Prince", category: "M4" },
  { id: "m4-17", name: "Anil Patel", category: "M4", dbName: "Anil Patel" },
  { id: "m4-18", name: "vishal", category: "M4", dbName: "Vishal Bagwe" },
  { id: "m4-19", name: "Vivek Dange", category: "M4", dbName: "Vivek Dange" },
  { id: "m4-20", name: "vijay Rai", category: "M4", dbName: "Vijai Rai" }
];
