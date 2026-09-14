// Tipos cliente alineados con los contratos reales de la API (/api/v1).

// ── Autenticación ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

export interface LoginPayload {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

// ── Paginación (meta estable del backend) ────────────────────────────────────
export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ── Facebook / Páginas ───────────────────────────────────────────────────────
export interface SafeFacebookAccount {
  id: string;
  facebookUserId: string;
  facebookUserName: string | null;
  email: string | null;
  tokenType: string;
  tokenExpiresAt: string | null;
  scopes: unknown;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DISCONNECTED';
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  pages?: PageListRow[];
}

export interface OAuthStart {
  authorizeUrl: string;
  state: string;
  expiresInSeconds: number;
}

export interface PageListRow {
  id: string;
  name: string;
  facebookPageId: string;
  category: string | null;
  pictureUrl: string | null;
  followersCount: number;
  status: string;
  updatedAt: string;
  account: { id: string; facebookUserName: string | null; status: string } | null;
}

export interface PageMetricsPoint {
  date: string;
  followersCount: number;
  totalPosts: number;
  totalInteractions: number;
  reachedCount: number;
  impressionsCount: number;
  engagedUsersCount: number;
}

// ── Campañas ─────────────────────────────────────────────────────────────────
export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface CampaignGroupInput {
  percentage: number;
  intervalSeconds: number;
  waitAfterSeconds?: number;
}

export interface CreateCampaignPayload {
  pageId: string;
  name: string;
  description?: string;
  contentTemplate: string;
  imageUrls?: string[];
  videoUrl?: string;
  groups: CampaignGroupInput[];
  totalActions: number;
  intervalSeconds?: number;
  groupsWaitSeconds?: number;
  startAt: string;
  endsAt?: string;
  aiGenerated?: boolean;
  aiPrompt?: string;
}

export interface CampaignGroup {
  id: string;
  position: number;
  name: string;
  percentage: number;
  intervalSeconds: number;
  waitAfterSeconds: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  actionsTarget: number;
  actionsDone: number;
}

export interface Campaign {
  id: string;
  pageId: string;
  accountId: string;
  name: string;
  description: string | null;
  contentTemplate: string;
  imageUrls: string[];
  videoUrl: string | null;
  totalActions: number;
  intervalSeconds: number;
  groupsWaitSeconds: number;
  startAt: string;
  endsAt: string | null;
  status: CampaignStatus;
  actionsDone: number;
  actionsFailed: number;
  errorMessage: string | null;
  aiGenerated: boolean;
  aiPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  campaignGroups?: CampaignGroup[];
}

export interface CampaignProgress {
  campaign: Campaign;
  groups: CampaignGroup[];
  postsTotal: number;
  postsDone: number;
  postsFailed: number;
}

export interface CampaignListRow {
  id: string;
  pageId: string;
  accountId: string;
  name: string;
  description: string | null;
  totalActions: number;
  actionsDone: number;
  actionsFailed: number;
  startAt: string;
  endsAt: string | null;
  status: CampaignStatus;
  aiGenerated: boolean;
  createdAt: string;
  page: { id: string; name: string };
}

// ── Posts ────────────────────────────────────────────────────────────────────
export type PostStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export interface CreatePostPayload {
  pageId: string;
  campaignId?: string;
  content: string;
  imageUrls?: string[];
  videoUrl?: string;
  scheduledFor?: string;
  aiGenerated?: boolean;
}

export interface EngagementMetric {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
}

export interface PostDetail {
  id: string;
  campaignId: string | null;
  pageId: string;
  content: string;
  imageUrls: string[];
  videoUrl: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  metaObjectId: string | null;
  metaPermalinkUrl: string | null;
  status: PostStatus;
  aiGenerated: boolean;
  aiProvider: string | null;
  statusChangedAt: string;
  page: { id: string; name: string };
  campaign: { id: string; name: string } | null;
  engagement: EngagementMetric | null;
  _count: { comments: number };
}

export interface PostListRow {
  id: string;
  content: string;
  status: PostStatus;
  pageId: string;
  campaignId: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  metaPermalinkUrl: string | null;
  aiGenerated: boolean;
  statusChangedAt: string;
  page: { id: string; name: string };
  campaign: { id: string; name: string } | null;
  engagement: EngagementMetric | null;
  _count: { comments: number };
}

// ── Comentarios ──────────────────────────────────────────────────────────────
export type CommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED' | 'RESPONDED';
export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface CommentDetail {
  id: string;
  postId: string;
  pageId: string;
  metaCommentId: string;
  fromUserId: string | null;
  fromName: string | null;
  parentId: string | null;
  message: string;
  isHidden: boolean;
  isFromPage: boolean;
  riskLevel: RiskLevel;
  status: CommentStatus;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
  post: { id: string; content: string; metaPermalinkUrl: string | null };
  page: { id: string; name: string };
  replies: CommentDetail[];
}

export interface ReplyCommentPayload {
  message: string;
  tone?: 'neutral' | 'friendly' | 'formal' | 'brief';
}

export interface AutoReplyPayload {
  tone?: 'neutral' | 'friendly' | 'formal' | 'brief';
}

export interface ModerateCommentPayload {
  action: 'hide' | 'unhide' | 'delete';
  reason?: string;
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export interface RecentActivityItem {
  id: string;
  action: string;
  category: string;
  pageId: string | null;
  campaignId: string | null;
  postId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { displayName: string; email: string } | null;
}

export interface DashboardSummary {
  totals: {
    postsPublicados: number;
    programados: number;
    fallidos: number;
    campañasActivas: number;
    paginasConectadas: number;
    comentariosRecientes: number;
    respuestasPendientes: number;
  };
  actividadReciente: Paginated<RecentActivityItem>;
}

export interface EngagementSeriesDay {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  engagements: number;
  followers: number | null;
  totalInteractions: number | null;
  reached: number | null;
  engagedUsers: number | null;
}

export interface EngagementSeries {
  pageId: string | null;
  range: '7d' | '30d';
  from: string;
  to: string;
  dias: EngagementSeriesDay[];
}

// ── Auditoría ────────────────────────────────────────────────────────────────
export interface AuditFilters {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  pageId?: string;
  campaignId?: string;
  from?: string;
  to?: string;
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  pageId: string | null;
  campaignId: string | null;
  postId: string | null;
  action: string;
  category:
    | 'AUTH'
    | 'FACEBOOK'
    | 'CAMPAIGN'
    | 'POST'
    | 'COMMENT'
    | 'AI'
    | 'WEBHOOK'
    | 'SYSTEM'
    | 'SECURITY'
    | 'DASHBOARD';
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ── IA ───────────────────────────────────────────────────────────────────────
export interface GeneratePostPayload {
  pageId: string;
  theme: string;
  audience?: string;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
}

export interface GeneratePostResult {
  success: boolean;
  text: string;
}

export interface CommentAnalysisResult {
  commentId: string;
  message: string;
  riskLevel: RiskLevel;
  sentiment?: string;
  suggestedAction?: string;
  explanation?: string;
}

export interface AnalyzeCommentsPayload {
  commentIds: string[];
}

export interface AnalyzeCommentsResult {
  success: boolean;
  results: CommentAnalysisResult[];
}

// ── Usuarios (administración) ────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export interface CreateUserPayload {
  email: string;
  username: string;
  password: string;
  displayName: string;
  roles: UserRole[];
}

export interface UpdateUserPayload {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isActive?: boolean;
  password?: string;
  roles?: UserRole[];
}