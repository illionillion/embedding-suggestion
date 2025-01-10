"use client";

import { getSuggestions } from "@/actions/suggestion";
import { ForceGraph2D } from "react-force-graph";
import { Button, Center, Container, Drawer, DrawerBody, DrawerFooter, DrawerHeader, Heading, HStack, Input, Loading, Tag, Text, useBoolean, useDisclosure, Wrap } from "@yamada-ui/react";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { suggestions } from "@/utils/data";

// 手動で ForceGraphMethods 型を定義
interface ForceGraphMethods {
  d3Force: (force: string) => {
    strength: (value: number) => void;
    distance?: (value: (link: Link) => number) => void;
  } | undefined;
}

interface Node {
  id: string;
  label?: string;
  name?: string;
  x?: number;
  y?: number;
  __bckgDimensions?: [number, number];
}

interface Link {
  source: string;
  target: string;
  value: number;
}

export default function Home() {
  const DynamicForceGraph2D = dynamic(() => import('react-force-graph').then(mod => mod.ForceGraph2D), {
    ssr: false,
    loading: () => <Center w="full" h="full">
      <Loading />
    </Center>
  }) as typeof ForceGraph2D;

  const graphRef = useRef<ForceGraphMethods | null>(null); // 型を追加
  const [query, setQuery] = useState("");
  const cacheRef = useRef(new Map<string, Awaited<ReturnType<typeof getSuggestions>>>());
  const [data, setData] = useState<Awaited<ReturnType<typeof getSuggestions>>>({ nodes: [], links: [] });
  const [selectItem, setSelectItem] = useState<typeof suggestions[number] | null>(null);
  const [isLoading, { on: start, off: end }] = useBoolean();
  const { open, onOpen, onClose } = useDisclosure()

  const handleSearch = async () => {
    const cache = cacheRef.current;
    if (!query) return;
    start();
    console.log("query", query);
    const result = cache.has(query) ? cache.get(query) : await getSuggestions(query);
    if (result) {
      console.log(result);
      cache.set(query, result);
      setData(result);
    }
    end();
  };

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current?.d3Force("charge")?.strength(-1000); // ノード間の距離を広げる
      graphRef.current?.d3Force("link")?.distance?.((link) => {
        // 類似度が高いほど距離を短く、低いほど距離を長く
        return (1 - link.value) * 300;  // 類似度に応じて距離を調整（距離が広がるほど類似度が低い）
      });
    }
  }, [data]);

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
      <DynamicForceGraph2D
        ref={graphRef as any}
        graphData={data}
        nodeLabel={(node: Node) => node.label || ""}
        nodeAutoColorBy="id"
        linkWidth={(link: Link) => link.value * 10}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(link: Link) => link.value > 0.7 ? 'red' : 'blue'}
        nodeCanvasObject={(node: Node, ctx, globalScale) => {
          const label = node.label || "";
          const fontSize = 12 / globalScale; // スケールに応じてフォントサイズ調整
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.2) as [number, number]; // 少しパディングを追加

          // 検索キーワードのノードに色をつける
          if (node.label === query) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.8)"; // 検索キーワードのノードに緑色
          } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          }

          // 背景の描画
          ctx.fillRect(
            (node.x || 0) - bckgDimensions[0] / 2,
            (node.y || 0) - bckgDimensions[1] / 2,
            ...bckgDimensions
          );

          // テキストの描画
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "black";
          ctx.fillText(label, node.x || 0, node.y || 0);

          // 背景サイズを保存（ヒット領域のため）
          node.__bckgDimensions = bckgDimensions;
        }}
        nodePointerAreaPaint={(node: Node, color, ctx) => {
          const bckgDimensions = node.__bckgDimensions;
          if (bckgDimensions) {
            ctx.fillStyle = color;
            ctx.fillRect(
              (node.x || 0) - bckgDimensions[0] / 2,
              (node.y || 0) - bckgDimensions[1] / 2,
              ...bckgDimensions
            );
          }
        }}
        onNodeClick={(node, e) => {
          if (node.id === "query") {
            return
          }
          // ノードをクリックした際の遷移処理
          setSelectItem(suggestions.find((item) => item.name === node.name) || null);
          console.log(node, e);
          onOpen();
        }}
      />
      {/* ドロワーの中身部分にpointerEvents: "auto"を指定したい */}
      <Drawer open={open} onClose={onClose}>
      <DrawerHeader>{selectItem?.name || "ノード詳細"}</DrawerHeader>
      <DrawerBody>
        {selectItem ? (
          <>
            <Text fontSize="lg">サークル名: {selectItem.name}</Text>
            <Wrap gap="md"><Text>ラベル:</Text>{selectItem.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Wrap>
            <Text textWrap="wrap">概要: {selectItem.description}</Text>
          </>
        ) : (
          <Text>ノードが選択されていません</Text>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button variant="ghost" onClick={onClose}>
          とじる
        </Button>
        <Button colorScheme="primary">移動する</Button>
      </DrawerFooter>
    </Drawer>
    </Container>
  );
}