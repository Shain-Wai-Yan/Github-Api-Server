const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors"); // Add this line
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors()); // Add this line

app.get("/api/github/*", async (req, res) => {
  const githubPath = req.params[0];
  try {
    const response = await fetch(`https://api.github.com/${githubPath}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "Your-Website",
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error proxying GitHub request:", error);
    res.status(500).json({ error: "Failed to fetch data from GitHub" });
  }
});

app.listen(PORT, () => console.log(`Magic server is running on port ${PORT}!`));

app.get("/", (req, res) => {
  res.send("GitHub Proxy Server is Running! 🚀");
});
