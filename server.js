const express = require("express")
const fetch = require("node-fetch")
const cors = require("cors")
const dotenv = require("dotenv")
const app = express()
const PORT = process.env.PORT || 3000

// Load environment variables
dotenv.config()

// Enable CORS for all routes
app.use(cors())

// Home route
app.get("/", (req, res) => {
  res.send("GitHub Proxy Server is Running! 🚀")
})

// General GitHub API proxy endpoint
app.get("/api/github/*", async (req, res, next) => {
  const githubPath = req.params[0]

  // Skip proxying for custom endpoints that should be handled separately
  if (
    githubPath.includes("/detailed-activity") ||
    githubPath.includes("/top-languages") ||
    githubPath.includes("/pinned") ||
    githubPath.includes("/contributions")
  ) {
    return next()
  }

  try {
    console.log(`Proxying request to: https://api.github.com/${githubPath}`)

    const response = await fetch(`https://api.github.com/${githubPath}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "GitHub-Profile-Viewer",
      },
    })

    // Check if response is OK
    if (!response.ok) {
      console.error(`GitHub API error: ${response.status} - ${response.statusText}`)
      const errorData = await response.json().catch(() => ({}))
      return res.status(response.status).json({
        error: `GitHub API error: ${response.status}`,
        details: errorData,
      })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error("Error proxying GitHub request:", error)
    res.status(500).json({ error: "Failed to fetch data from GitHub", message: error.message })
  }
})

// Specific endpoint for contribution data using GraphQL API
app.get("/api/github/users/:username/contributions", async (req, res) => {
  const username = req.params.username
  try {
    console.log(`Fetching contributions for user: ${username}`)

    // GraphQL query to get contribution data for the past year
    const query = `
      query {
        user(login: "${username}") {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                  color
                }
              }
            }
          }
        }
      }
    `

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Profile-Viewer",
      },
      body: JSON.stringify({ query }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error("GraphQL error:", data.errors)
      throw new Error(data.errors[0].message)
    }

    // Process the data to match the format expected by your frontend
    const calendar = data.data?.user?.contributionsCollection?.contributionCalendar

    if (!calendar) {
      return res.status(404).json({
        error: "Contribution data not found",
        rawResponse: data,
      })
    }

    const totalContributions = calendar.totalContributions

    // Flatten the nested structure to a simple array of {date, count} objects
    const contributions = []
    calendar.weeks.forEach((week) => {
      week.contributionDays.forEach((day) => {
        contributions.push({
          date: day.date,
          count: day.contributionCount,
          color: day.color,
        })
      })
    })

    res.json({
      totalContributions,
      contributions,
    })
  } catch (error) {
    console.error("Error fetching contribution data:", error)
    res.status(500).json({ error: "Failed to fetch contribution data", message: error.message })
  }
})

// Endpoint to get user's pinned repositories
app.get("/api/github/users/:username/pinned", async (req, res) => {
  const username = req.params.username
  try {
    console.log(`Fetching pinned repositories for user: ${username}`)

    // GraphQL query to get pinned repositories
    const query = `
      query {
        user(login: "${username}") {
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes {
              ... on Repository {
                name
                description
                url
                stargazerCount
                forkCount
                primaryLanguage {
                  name
                  color
                }
                updatedAt
              }
            }
          }
        }
      }
    `

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Profile-Viewer",
      },
      body: JSON.stringify({ query }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error("GraphQL error:", data.errors)
      throw new Error(data.errors[0].message)
    }

    if (!data.data?.user?.pinnedItems?.nodes) {
      return res.status(404).json({
        error: "Pinned repositories not found",
        rawResponse: data,
      })
    }

    res.json(data.data.user.pinnedItems.nodes)
  } catch (error) {
    console.error("Error fetching pinned repositories:", error)
    res.status(500).json({ error: "Failed to fetch pinned repositories", message: error.message })
  }
})

// Endpoint to get user's top languages
app.get("/api/github/users/:username/top-languages", async (req, res) => {
  const username = req.params.username
  try {
    console.log(`Fetching top languages for user: ${username}`)

    // GraphQL query to get repositories with languages
    const query = `
      query {
        user(login: "${username}") {
          repositories(first: 100, orderBy: {field: UPDATED_AT, direction: DESC}, isFork: false) {
            nodes {
              name
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    name
                    color
                  }
                }
              }
            }
          }
        }
      }
    `

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Profile-Viewer",
      },
      body: JSON.stringify({ query }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error("GraphQL error:", data.errors)
      throw new Error(data.errors[0].message)
    }

    if (!data.data?.user?.repositories?.nodes) {
      return res.status(404).json({
        error: "Repository language data not found",
        rawResponse: data,
      })
    }

    // Process language data
    const languages = {}
    let totalSize = 0

    data.data.user.repositories.nodes.forEach((repo) => {
      if (repo.languages?.edges) {
        repo.languages.edges.forEach((edge) => {
          const { name, color } = edge.node
          const size = edge.size

          if (!languages[name]) {
            languages[name] = { size: 0, color }
          }

          languages[name].size += size
          totalSize += size
        })
      }
    })

    // If no languages were found
    if (totalSize === 0) {
      return res.json([])
    }

    // Convert to array and calculate percentages
    const languageArray = Object.keys(languages).map((name) => ({
      name,
      color: languages[name].color,
      size: languages[name].size,
      percentage: ((languages[name].size / totalSize) * 100).toFixed(1),
    }))

    // Sort by size (descending)
    languageArray.sort((a, b) => b.size - a.size)

    res.json(languageArray)
  } catch (error) {
    console.error("Error fetching top languages:", error)
    res.status(500).json({ error: "Failed to fetch top languages", message: error.message })
  }
})

// Endpoint to get detailed user activity
app.get("/api/github/users/:username/detailed-activity", async (req, res) => {
  const username = req.params.username
  try {
    console.log(`Fetching detailed activity for user: ${username}`)

    // GraphQL query to get detailed user activity
    const query = `
      query {
        user(login: "${username}") {
          contributionsCollection {
            commitContributionsByRepository(maxRepositories: 10) {
              repository {
                name
                url
              }
              contributions {
                totalCount
              }
            }
            pullRequestContributionsByRepository(maxRepositories: 10) {
              repository {
                name
                url
              }
              contributions {
                totalCount
              }
            }
            issueContributionsByRepository(maxRepositories: 10) {
              repository {
                name
                url
              }
              contributions {
                totalCount
              }
            }
          }
        }
      }
    `

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Profile-Viewer",
      },
      body: JSON.stringify({ query }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error("GraphQL error:", data.errors)
      throw new Error(data.errors[0].message)
    }

    if (!data.data?.user?.contributionsCollection) {
      return res.status(404).json({
        error: "Detailed activity data not found",
        rawResponse: data,
      })
    }

    res.json(data.data.user.contributionsCollection)
  } catch (error) {
    console.error("Error fetching detailed activity:", error)
    res.status(500).json({ error: "Failed to fetch detailed activity", message: error.message })
  }
})

// Fix for the detailed-activity endpoint without the username prefix
app.get("/detailed-activity", (req, res) => {
  res.status(400).json({
    error: "Invalid endpoint",
    message: "This endpoint requires a username. Use /api/github/users/:username/detailed-activity instead.",
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: "Server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  })
})

// Start the server
app.listen(PORT, () => console.log(`GitHub API proxy server running on port ${PORT}!`))

module.exports = app
