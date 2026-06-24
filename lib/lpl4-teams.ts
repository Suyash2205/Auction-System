export type Lpl4Team = {
  name: string;
  ownerName: string;
  /** Second owner when they are not in the player pool. */
  coOwnerName?: string;
  color: string;
  /** List name from lpl4-players when the owner is also a playing squad member. */
  playingOwnerListName?: string;
};

export const lpl4Teams: Lpl4Team[] = [
  { name: "Ark Smashers", ownerName: "Arpit", color: "#e11d48" },
  { name: "Daring Spartans", ownerName: "Manish", color: "#1f8f64", playingOwnerListName: "Manish M10" },
  { name: "Turf Addicts", ownerName: "Swayam Mozar", color: "#1677a8", playingOwnerListName: "Swayam Mozar" },
  {
    name: "TSG Picklers",
    ownerName: "Jay Shah",
    coOwnerName: "Paresh",
    color: "#d8643f",
    playingOwnerListName: "Jay shah"
  },
  {
    name: "Thane Brandspine Strikers",
    ownerName: "Vijay Rai",
    coOwnerName: "Abhay Sharma",
    color: "#7f56d9",
    playingOwnerListName: "vijay Rai"
  },
  { name: "Kitchen Kings", ownerName: "Kartik Juneja", color: "#f59e0b", playingOwnerListName: "Kartik Juneja" },
  { name: "M Fit", ownerName: "Edwin Lobo", color: "#0ea5e9" },
  { name: "Pickleball Addicts", ownerName: "Aakanksha", color: "#ec4899", playingOwnerListName: "Aakanksha" },
  {
    name: "Ninja Blasters",
    ownerName: "Surjit Parvi",
    coOwnerName: "Karan",
    color: "#6366f1",
    playingOwnerListName: "Surjit Parvi"
  },
  {
    name: "Kabhi Dink Kabhi Drive",
    ownerName: "Sonesh Shukla",
    color: "#14b8a6",
    playingOwnerListName: "Sonesh Shukla"
  }
];
