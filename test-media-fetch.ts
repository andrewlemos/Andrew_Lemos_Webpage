async function runMediaFetch() {
  const images = [
    "http://localhost:3000/arquivos/LOGO%20ANDREW.png",
    "http://localhost:3000/arquivos/Apresenta%C3%A7%C3%A3o%20do%20Canal.jpg",
    "http://localhost:3000/arquivos/WhatsApp%20Image%202025-03-01%20at%2020.11.40%20(2)%20-%20Copia.jpeg",
    "http://localhost:3000/arquivos/peixe1.jpg"
  ];

  console.log("=== Launching local fetches to test responses ===");
  for (const img of images) {
    try {
      const res = await fetch(img);
      console.log(`Fetch to "${img}" -> Status ${res.status} | Content-Type: ${res.headers.get("content-type")}`);
    } catch (e: any) {
      console.error(`Fetch to ${img} failed:`, e.message);
    }
  }
}

runMediaFetch();
