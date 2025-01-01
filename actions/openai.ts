"use server";
import { suggestions } from "@/utils/data";
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

export async function getSuggestions(query: string) {
  try {
    // クエリを埋め込みに変換
    const queryResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    const queryEmbedding = queryResponse.data[0].embedding;

    // 再帰的にネットワークを構築する関数
    const buildNetwork = async (
      parentId: string,
      parentEmbedding: number[],
      parentLabels: string[], // 親のラベルリストを渡す
      depth: number = 0,
      visitedNodes: Set<string> = new Set()
    ) => {
      console.log("depth:", depth);

      if (depth > 2) return { nodes: [], links: [] }; // 深さ制限

      const children = await Promise.all(
        suggestions.map(async (item) => {
          const inputText = `${item.name} ${item.tags.join(" ")} ${
            item.description
          }`;
          const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: inputText,
          });
          const childEmbedding = response.data[0].embedding;
          const similarity = cosineSimilarity(parentEmbedding, childEmbedding);

          // 親のラベルリストに同じ名前のサークルが含まれている場合は除外
          if (parentLabels.includes(item.name)) {
            return null;
          }

          // 閾値を動的に変更
          const threshold =
            depth === 0 ? 0.8
              : depth === 0
              ? 0.7
              : 0.65;

          if (similarity > threshold) {
            const nodeId = `${item.name}-${depth}-${childEmbedding.join(",")}`;

            if (visitedNodes.has(nodeId)) {
              return null;
            }

            visitedNodes.add(nodeId);

            return {
              id: nodeId,
              label: item.name,
              embedding: childEmbedding,
              similarity,
              depth,
            };
          }
          return null;
        })
      );

      const maxLinksPerNode = 3;
      const validChildren = children
        .filter((child) => child !== null)
        .sort((a, b) => b!.similarity - a!.similarity)
        .slice(0, maxLinksPerNode);

      const links = validChildren.map((child) => ({
        source: parentId,
        target: child!.id,
        value: child!.similarity,
      }));
      const nodes = validChildren.map((child) => ({
        id: child!.id,
        label: `${child!.label} (Rank: ${depth + 1})`,
      }));

      // 親のラベルリストを次の再帰呼び出しで使うために更新
      const updatedParentLabels = [...parentLabels, ...validChildren.map((child) => child!.label)];

      for (const child of validChildren) {
        const subNetwork = await buildNetwork(
          child!.id,
          child!.embedding,
          updatedParentLabels, // 更新された親のラベルリストを渡す
          depth + 1,
          visitedNodes
        );
        nodes.push(...subNetwork.nodes);
        links.push(...subNetwork.links);
      }

      return { nodes, links };
    };

    // 最初の親ノードはダミー値で呼び出す
    const network = await buildNetwork("query", queryEmbedding, [query]);
    network.nodes.unshift({ id: "query", label: query }); // 中心ノード追加
    // console.log(network);

    return network;
  } catch (error) {
    console.error("Error in getSuggestions:", error);
    return { nodes: [], links: [] };
  }
}
