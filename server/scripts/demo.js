async function demo() {
  const response = await fetch("http://localhost:3000/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Jane",
      lastName: "Doe",
    }),
  });
  const data = await response.json();
  console.log("Added user:", data);
}

demo();
