export interface TreeNode {
  node_id: string;
  title: string;
  summary: string;
  page_range: string;
  content?: string;
  children?: TreeNode[];
  depth?: number;
  token_count?: number;
}

export interface DocumentItem {
  id: string;
  filename: string;
  created_at: string;
  chunk_count: number;
  num_nodes: number;
  tree: TreeNode[];
  size_bytes?: number;
  status?: string;
}

export interface RetrievedChunk {
  chunk_id: string;
  doc_id: string;
  chunk_index: number;
  page_num: number;
  text: string;
  vector_score: number;
  rerank_score: number;
  before_rank: number;
  after_rank: number;
  rank_delta: number;
  token_count?: number;
}

export interface VectorQueryResponse {
  mode: string;
  query: string;
  answer: string;
  retrieved_chunks: RetrievedChunk[];
  raw_candidates?: RetrievedChunk[];
  latency_breakdown: {
    total_ms: number;
    vector_search_ms: number;
    rerank_ms: number;
    llm_ms: number;
  };
}

export interface VectorlessQueryResponse {
  mode: string;
  query: string;
  answer: string;
  selected_nodes: TreeNode[];
  reasoning_trace: string;
  skeleton_nodes_evaluated?: number;
  latency_breakdown: {
    total_ms: number;
    tree_reasoning_ms: number;
    llm_ms: number;
  };
}

export interface GoldenQuestion {
  id: string;
  question: string;
  ground_truth: string;
  expected_chunk_ids?: string[];
  expected_node_ids?: string[];
  keywords?: string[];
}

export interface ModeMetrics {
  mrr: number;
  ndcg_4: number;
  hit_rate_1: number;
  hit_rate_4: number;
  avg_rank_delta: number;
  recall_dropoff: number;
  context_precision: number;
  context_recall: number;
  noise_sensitivity: number;
  faithfulness: number;
  answer_relevancy: number;
  avg_latency_ms: number;
  context_tokens?: number;
  tokens_saved?: number;
}

export interface EvalRunRecord {
  id: string;
  run_name: string;
  mode: string;
  metrics: ModeMetrics;
  latency_ms: number;
  created_at: string;
}

export interface HealthStatus {
  status: string;
  database: string;
  lancedb: string;
  ollama: {
    status: string;
    target_gen_model: string;
    target_embed_model: string;
    available_models?: string[];
  };
}

export interface StudioNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  targetTab?: 'arena' | 'docs' | 'eval' | 'traces' | 'settings';
}

export interface StudioToast {
  id: string;
  message: string;
  type?: 'default' | 'success' | 'warning' | 'error';
  durationSeconds?: number;
  undoAction?: () => void;
}

export interface TraceSpan {
  name: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  status: string;
  color: string;
}

export interface TraceRecord {
  id: string;
  timestamp: string;
  engine: 'DUAL_ARENA' | 'VECTOR_FLASHRANK' | 'TREE_REASONING';
  query: string;
  status: '200_OK' | 'FALLBACK' | 'PRUNED';
  vector_latency_ms: number;
  tree_latency_ms: number;
  total_latency_ms: number;
  chunks_retrieved: number;
  tree_depth: number;
  precision_delta: number;
  vector_spans: TraceSpan[];
  tree_spans: TraceSpan[];
  vram_allocated_mb: number;
  tree_nodes_scanned: number;
}
