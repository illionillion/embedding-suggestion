"use client";

import { getSuggestions } from "@/actions/suggestion";
import { Button, Center, Container, Heading, HStack, Input, Loading, useBoolean, } from "@yamada-ui/react";
import dynamic from "next/dynamic";
import { useState, useRef } from "react";

export default function Home() {
  const CustomGraph = dynamic(() => import("@/components/custom-graph").then(mod => mod.default), { ssr: false,
loading: () => <Center w="full" h="full"><Loading /></Center>

   });
  const [query, setQuery] = useState("");
  // queryとは別で今検索してるものを保持したい
  const [currentQuery, setCurrentQuery] = useState("");
  const cacheRef = useRef(new Map<string, Awaited<ReturnType<typeof getSuggestions>>>());
  const [data, setData] = useState<Awaited<ReturnType<typeof getSuggestions>>>({ nodes: [], links: [] });
  const [isLoading, { on: start, off: end }] = useBoolean();

  const handleSearch = async () => {
    const cache = cacheRef.current;
    if (!query) return;
    start();
    console.log("query", query);
    const result = cache.has(query) ? cache.get(query) : await getSuggestions(query);
    console.log(result);
    if (result) {
      cache.set(query, result);
      setCurrentQuery(query);
      setData(result);
    }
    end();
  };

  return (
    <Container w="full" h="100dvh" m="auto">
      <Heading>検索</Heading>
      <HStack>
        <Input
          type="text"
          placeholder="キーワード入力"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          disabled={isLoading}
        />
        <Button onClick={handleSearch} loading={isLoading}>
          検索
        </Button>
      </HStack>
      <CustomGraph data={data} query={currentQuery} />
    </Container>
  );
}