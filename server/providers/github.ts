import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export interface GitHubRepoInfo {
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssuesCount: number;
  topics: string[];
}

export interface GitHubFileItem {
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export class GitHubProvider implements AIProvider {
  readonly id = 'github';
  readonly name = 'GitHub Integration Specialist';
  readonly capabilities: ProviderCapabilities = {
    chat: false,
    reasoning: true,
    coding: true,
    github: true,
    multimodal: false,
    streaming: false,
    voiceLive: false,
    fastTasks: true,
  };

  private readonly apiBase = 'https://api.github.com';

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim());
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  private getHeaders(): Record<string, string> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Columbina-AI-Assistant',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.apiBase}/user`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepoInfo> {
    const res = await fetch(`${this.apiBase}/repos/${owner}/${repo}`, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`GitHub repo not found or inaccessible (${res.status})`);
    }
    const data = await res.json();
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      defaultBranch: data.default_branch || 'main',
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      openIssuesCount: data.open_issues_count || 0,
      topics: data.topics || [],
    };
  }

  async getStructure(owner: string, repo: string, path = ''): Promise<GitHubFileItem[]> {
    const res = await fetch(
      `${this.apiBase}/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to read path /${path} from ${owner}/${repo}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return [{ path: data.path, type: data.type, size: data.size }];
    }
    return data.map((item: any) => ({
      path: item.path,
      type: item.type === 'dir' ? 'dir' : 'file',
      size: item.size,
    }));
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const res = await fetch(
      `${this.apiBase}/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) {
      throw new Error(`File ${path} not found in ${owner}/${repo}`);
    }
    const data = await res.json();
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return data.content || '';
  }

  async getCommits(owner: string, repo: string, count = 10): Promise<any[]> {
    const res = await fetch(
      `${this.apiBase}/repos/${owner}/${repo}/commits?per_page=${count}`,
      {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((c: any) => ({
      sha: c.sha?.slice(0, 7),
      message: c.commit?.message?.split('\n')[0],
      author: c.commit?.author?.name,
      date: c.commit?.author?.date,
    }));
  }

  async getIssues(owner: string, repo: string, state = 'open', count = 10): Promise<any[]> {
    const res = await fetch(
      `${this.apiBase}/repos/${owner}/${repo}/issues?state=${state}&per_page=${count}`,
      {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((i: any) => !i.pull_request)
      .map((i: any) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        user: i.user?.login,
        updatedAt: i.updated_at,
      }));
  }

  async getPullRequests(owner: string, repo: string, state = 'open', count = 10): Promise<any[]> {
    const res = await fetch(
      `${this.apiBase}/repos/${owner}/${repo}/pulls?state=${state}&per_page=${count}`,
      {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((p: any) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      user: p.user?.login,
      updatedAt: p.updated_at,
    }));
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const query = request.messages[request.messages.length - 1]?.content || '';

    // Match repo patterns like owner/repo
    const repoMatch = query.match(/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/);
    const owner = repoMatch ? repoMatch[1] : 'jamanrafi41-create';
    const repo = repoMatch ? repoMatch[2] : 'my-ai-model0.2';

    try {
      const repoInfo = await this.getRepo(owner, repo);
      const structure = await this.getStructure(owner, repo);
      const commits = await this.getCommits(owner, repo, 5);

      const summaryText = `[GitHub Context] Repository: ${repoInfo.fullName} (${repoInfo.stars}★, default: ${repoInfo.defaultBranch}). Description: ${repoInfo.description || 'None'}. Recent files: ${structure.slice(0, 10).map((f) => f.path).join(', ')}. Recent commits: ${commits.map((c) => `${c.sha}: ${c.message}`).join(' | ')}.`;

      const latencyMs = Date.now() - startTime;
      healthManager.recordSuccess(this.id, latencyMs);

      return {
        text: summaryText,
        provider: this.id,
        model: 'github-rest-v3',
        latencyMs,
        raw: { repoInfo, structure, commits },
      };
    } catch (err: any) {
      healthManager.recordFailure(this.id, err);
      throw err;
    }
  }
}

export const gitHubProvider = new GitHubProvider();
