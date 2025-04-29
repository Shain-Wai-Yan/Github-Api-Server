const express = require("express");
const fetch = require("node-fetch");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/github/*", async (req, res) => {
  const githubPath = req.params[0];
  const response = await fetch(`https://api.github.com/${githubPath}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      "User-Agent": "Your-Website",
    },
  });
  const data = await response.json();
  res.json(data);
});

app.listen(PORT, () => console.log("Magic server is running!"));
