import fs from "fs"
import fetch from "node-fetch"

const REPO = process.env.GITHUB_REPOSITORY
const HEAD_TAG = process.env.GITHUB_REF.replace("refs/tags/", "")
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const jiraRegex = /\b([A-Z]+-\d+)\b/

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json"
}

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...headers, ...extraHeaders } })
  if (!res.ok) throw new Error(`Erro ao buscar ${url}: ${res.status}`)
  return res.json()
}

async function getPreviousTag() {
  const url = `https://api.github.com/repos/${REPO}/tags`
  const tags = await fetchJson(url)
  const tagNames = tags.map(tag => tag.name).filter(name => name !== HEAD_TAG)
  return tagNames[0] || null
}

async function getCommitsBetween(base, head) {
  const url = `https://api.github.com/repos/${REPO}/compare/${base}...${head}`
  const json = await fetchJson(url)
  return json.commits
}

async function getPRForCommit(sha) {
  const url = `https://api.github.com/repos/${REPO}/commits/${sha}/pulls`
  const json = await fetchJson(url, {
    Accept: "application/vnd.github.groot-preview+json"
  })
  return json.length > 0 ? json[0] : null
}

async function main() {
  const BASE_TAG = await getPreviousTag()
  if (!BASE_TAG) throw new Error("Tag anterior não encontrada.")

  console.log(`Gerando changelog: ${BASE_TAG} → ${HEAD_TAG}`)
  const commits = await getCommitsBetween(BASE_TAG, HEAD_TAG)

  const groups = {}
  const noJira = []
  const contributorsMap = new Map()
  const prNumbersSet = new Set()

  for (const commit of commits) {
    const sha = commit.sha
    const pr = await getPRForCommit(sha)
    if (!pr) continue

    const number = pr.number
    if (prNumbersSet.has(number)) continue
    prNumbersSet.add(number)

    const title = pr.title
    const url = pr.html_url
    const user = pr.user

    if (user) {
      contributorsMap.set(user.login, {
        login: user.login,
        avatar: user.avatar_url,
        html_url: user.html_url
      })
    }

    const match = jiraRegex.exec(title)
    const prTitle = `Pull Request #${number}: ${title}`
    const userTitle = `Usuário: @${user.login}`
    const line = `- ${title} (<a href="${url}" title="${prTitle}">#${number}</a> by <a href="${user.html_url}" title="${userTitle}">@${user.login}</a>)`


    if (match) {
      const key = match[1]
      if (!groups[key]) groups[key] = []
      groups[key].push(line)
    } else {
      noJira.push(line)
    }
  }

  let output = `# Changelog ${HEAD_TAG}\n\n`

  const sortedKeys = Object.keys(groups).sort()
  for (const key of sortedKeys) {
    output += `## ${key}\n`
    groups[key].forEach(line => output += line + "\n")
    output += "\n"
  }

  if (noJira.length > 0) {
    output += `## Outros (sem key Jira)\n`
    noJira.forEach(line => output += line + "\n")
    output += "\n"
  }

  if (contributorsMap.size > 0) {
    output += `## Contribuidores\n\n`
    output += `<div style="display: flex; flex-wrap: wrap; gap: 16px;">\n`

    for (const contributor of contributorsMap.values()) {
      output += `
  <div style="display: flex; flex-direction: column; align-items: center; width: 80px;">
    <a href="${contributor.html_url}" title="@${contributor.login}" target="_blank">
      <img src="${contributor.avatar}&s=64" alt="@${contributor.login}" width="48" height="48" style="border-radius: 50%;"/>
    </a>
    <a href="${contributor.html_url}" target="_blank" style="text-align: center; font-size: 12px; margin-top: 4px;">${contributor.login}</a>
  </div>\n`
    }

    output += `</div>\n`
  }


  fs.writeFileSync("CHANGELOG.md", output)
  console.log("CHANGELOG.md gerado com sucesso.")
}

main().catch(err => {
  console.error("Erro:", err.message)
  process.exit(1)
})
