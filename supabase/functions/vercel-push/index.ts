import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

const projectNamePattern = /^(astranov|astranov\.eu|astranov-eu)$/i;

type ApiResult = { st: number; j: Record<string, unknown> };
type VercelProject = { id: string; name: string };
type VercelTeam = { id: string; slug: string };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function query(teamId: string) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

async function api(token: string, method: string, url: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { nonJson: true };
  }
  return { st: response.status, j: parsed };
}

function apiError(value: Record<string, unknown>) {
  const nested = value.error;
  const error = nested && typeof nested === "object"
    ? nested as Record<string, unknown>
    : value;
  return {
    code: typeof error.code === "string" ? error.code : null,
    message: typeof error.message === "string" ? error.message.slice(0, 160) : null,
  };
}

function teamsFrom(value: Record<string, unknown>): VercelTeam[] {
  return Array.isArray(value.teams) ? value.teams as VercelTeam[] : [];
}

function projectsFrom(value: Record<string, unknown>): VercelProject[] {
  return Array.isArray(value.projects) ? value.projects as VercelProject[] : [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = Deno.env.get("VERCEL_TOKEN") ||
    Deno.env.get("VERCEL_ACCESS_TOKEN") ||
    Deno.env.get("VERCEL_API_TOKEN") ||
    Deno.env.get("NOW_TOKEN") || "";
  const configuredProjectId = (Deno.env.get("VERCEL_PROJECT_ID") || "").trim();
  const configuredTeamId = (Deno.env.get("VERCEL_TEAM_ID") || "").trim();
  const report: Record<string, unknown> = {
    hasVercel: Boolean(token),
    userSt: null,
    teamsSt: null,
    teams: [],
    project: {
      projectId: configuredProjectId,
      projectName: "",
      teamId: configuredTeamId,
      source: configuredProjectId ? "VERCEL_PROJECT_ID" : "",
    },
  };

  if (!token) return json(report, 503);

  const [userResult, teamsResult] = await Promise.all([
    api(token, "GET", "https://api.vercel.com/v2/user"),
    api(token, "GET", "https://api.vercel.com/v2/teams?limit=100"),
  ]);
  report.userSt = userResult.st;
  report.teamsSt = teamsResult.st;
  if (userResult.st !== 200) report.userErr = apiError(userResult.j);
  if (teamsResult.st !== 200) report.teamsErr = apiError(teamsResult.j);

  const teams = teamsFrom(teamsResult.j);
  report.teams = teams.map((team) => team.slug);

  let projectId = configuredProjectId;
  let projectName = "";
  let teamId = configuredTeamId;
  let projectSource = projectId ? "VERCEL_PROJECT_ID" : "";

  if (projectId) {
    const configuredProject = await api(
      token,
      "GET",
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${query(teamId)}`,
    );
    report.projectSt = configuredProject.st;
    if (configuredProject.st === 200) {
      projectId = typeof configuredProject.j.id === "string" ? configuredProject.j.id : projectId;
      projectName = typeof configuredProject.j.name === "string" ? configuredProject.j.name : "";
    } else {
      report.projectErr = apiError(configuredProject.j);
    }
  }

  if (!projectId && !teamId) {
    const slugLookups: Record<string, number> = {};
    for (const slug of ["astranov", "astranov.eu", "astranov-eu"]) {
      const teamBySlug = await api(
        token,
        "GET",
        `https://api.vercel.com/v2/teams?slug=${encodeURIComponent(slug)}`,
      );
      slugLookups[slug] = teamBySlug.st;
      const foundId = typeof teamBySlug.j.id === "string" ? teamBySlug.j.id : "";
      if (teamBySlug.st === 200 && foundId) {
        teamId = foundId;
        break;
      }
    }
    report.teamSlugLookups = slugLookups;
  }

  if (!projectId) {
    const nameLookups: Record<string, number> = {};
    for (const name of ["astranov", "astranov.eu", "astranov-eu"]) {
      const named = await api(
        token,
        "GET",
        `https://api.vercel.com/v9/projects/${encodeURIComponent(name)}${query(teamId)}`,
      );
      nameLookups[name] = named.st;
      if (named.st === 200 && typeof named.j.id === "string") {
        projectId = named.j.id;
        projectName = typeof named.j.name === "string" ? named.j.name : name;
        projectSource = `get:${name}`;
        break;
      }
    }
    report.nameLookups = nameLookups;
  }

  if (!projectId) {
    const scopes: Array<string | undefined> = [teamId || undefined, undefined, ...teams.map((team) => team.id)]
      .filter((value, index, all) => all.indexOf(value) === index);
    for (const scopeTeamId of scopes) {
      const projectsResult = await api(
        token,
        "GET",
        `https://api.vercel.com/v9/projects?limit=100${scopeTeamId ? `&teamId=${encodeURIComponent(scopeTeamId)}` : ""}`,
      );
      if (!scopeTeamId) report.personalProjectsSt = projectsResult.st;
      const match = projectsFrom(projectsResult.j).find((project) => projectNamePattern.test(project.name.trim()));
      if (match) {
        projectId = match.id;
        projectName = match.name;
        teamId = scopeTeamId || teamId || "";
        projectSource = `name:${match.name}`;
        break;
      }
    }
  }

  report.project = { projectId, projectName, teamId, source: projectSource };
  if (!projectId) return json(report, 404);

  const deployment = await api(
    token,
    "POST",
    `https://api.vercel.com/v13/deployments${query(teamId)}`,
    {
      name: projectName || "astranov",
      project: projectId,
      target: "production",
      gitSource: {
        type: "github",
        org: "notisastranov",
        repo: "astranov.eu",
        ref: "main",
      },
    },
  );
  report.deploySt = deployment.st;
  const deploymentId = typeof deployment.j.id === "string" ? deployment.j.id : "";
  report.deploy = {
    id: deploymentId || null,
    url: typeof deployment.j.url === "string" ? deployment.j.url : null,
    readyState: typeof deployment.j.readyState === "string" ? deployment.j.readyState : null,
    error: deployment.st >= 400 ? apiError(deployment.j) : null,
  };
  if (deployment.st >= 400 || !deploymentId) return json(report, 502);

  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const poll = await api(
      token,
      "GET",
      `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}${query(teamId)}`,
    );
    const readyState = typeof poll.j.readyState === "string" ? poll.j.readyState : "";
    report.readyState = readyState || null;
    report.url = typeof poll.j.url === "string" ? poll.j.url : null;
    if (["READY", "ERROR", "CANCELED"].includes(readyState)) break;
  }

  return json(report);
});