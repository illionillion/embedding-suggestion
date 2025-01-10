"use server";
import suggestions from "@/utils/suggestions-with-embeddings.json";
import OpenAI from "openai";

// OpenAI APIの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// コサイン類似度計算関数
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitude1 * magnitude2);
}

function generateTree(
  query: string,
  queryEmbedding: number[],
  suggestionsData: typeof suggestions
) {
  const nodes: { id: string; label: string; name: string }[] = [
    { id: "query", label: query, name: query },
  ];
  const links: { source: string; target: string; value: number }[] = [];

  // クエリと各サジェストの類似度を計算
  const similarities = suggestionsData.map((suggestion) => ({
    ...suggestion,
    similarity: cosineSimilarity(queryEmbedding, suggestion.embedding),
  }));

  // 類似度でソート
  similarities.sort((a, b) => b.similarity - a.similarity);

  // 上位3つをルートノードとして追加
  const topSuggestions = similarities.slice(0, 3);
  topSuggestions.forEach((suggestion) => {
    nodes.push({
      id: suggestion.name,
      label: suggestion.name,
      name: suggestion.name,
    });
    links.push({
      source: "query",
      target: suggestion.name,
      value: Number(suggestion.similarity.toFixed(2)),
    });
  });

  // 残りのサジェストを子ノードとして追加
  similarities.slice(3).forEach((suggestion) => {
    nodes.push({
      id: suggestion.name,
      label: suggestion.name,
      name: suggestion.name,
    });

    // 最も類似度の高いルートノードに接続
    const closestRoot = topSuggestions.reduce((prev, current) =>
      cosineSimilarity(suggestion.embedding, current.embedding) >
      cosineSimilarity(suggestion.embedding, prev.embedding)
        ? current
        : prev
    );

    links.push({
      source: closestRoot.name,
      target: suggestion.name,
      value: Number(
        cosineSimilarity(suggestion.embedding, closestRoot.embedding).toFixed(2)
      ),
    });
  });

  return { nodes, links };
}

export async function getSuggestions(query: string) {
  try {
    // クエリを埋め込みに変換
    const queryResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    const queryEmbedding = queryResponse.data[0].embedding;

    // 最初の親ノードはダミー値で呼び出す
    const network = generateTree(query, queryEmbedding, suggestions);

    return network;
  } catch (error) {
    console.error("Error in getSuggestions:", error);
    return { nodes: [], links: [] };
  }
}
