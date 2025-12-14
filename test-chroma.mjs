import fetch from "node-fetch";

const res = await fetch("https://mededu-vision-ai.onrender.com/api/v1/collections");
console.log("Status:", res.status);
console.log("Body:", await res.text());
