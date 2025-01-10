import OpenAI from "openai";
import { suggestions as originalSuggestions } from "@/utils/data";
import suggestions from "@/utils/suggestions-with-embeddings.json";
import { writeFileSync } from "fs";
import path from "path";

// OpenAI APIの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function calculateEmbeddings(batchSize: number = 5) {
  
  const generateEmbedding = async (suggestion: typeof originalSuggestions[number]) => {
    const inputText = `${suggestion.name} ${suggestion.tags.join(" ")} ${
      suggestion.description
    }`;
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: inputText,
    });
    const embedding = response.data[0].embedding;
    return { ...suggestion, embedding };
  }

  const filteredSuggestions = originalSuggestions.filter(suggestion => suggestions.every(s => s.name !== suggestion.name));
  console.log(filteredSuggestions);

  if (filteredSuggestions.length === 0) {
    return suggestions;
  }
  
  let updatedSuggestions: Awaited<ReturnType<typeof generateEmbedding>>[] = suggestions;
  for (let i = 0; i < filteredSuggestions.length; i += batchSize) {
    console.log(i);
    
    const batch = filteredSuggestions.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(generateEmbedding)
    );
    updatedSuggestions = [...updatedSuggestions, ...batchResults];
  }

  // JSONファイルへの書き出し
  writeFileSync(
    path.join(process.cwd(), "utils", "suggestions-with-embeddings.json"),
    JSON.stringify(updatedSuggestions, null, 2)
  );

  return updatedSuggestions;
}

calculateEmbeddings();
