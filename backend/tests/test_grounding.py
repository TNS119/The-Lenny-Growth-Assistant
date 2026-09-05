# backend/tests/test_grounding.py
import asyncio
from app.rag.retriever import TranscriptRetriever
from app.rag.embeddings import get_embedding

async def check():
    r = TranscriptRetriever(None, get_embedding)
    queries = [
        "How to make Dosa?",
        "Tell me how to make dosa",
        "What is the recipe for pasta?",
        "What is the capital of France?",
        "Who won the 2022 World Cup?",
        "How to bake a chocolate cake?",
        "Tell me about Brian Chesky",
        "Explain Elena Verna's viral loops",
        "What is Shreyas Doshi's LNO framework?"
    ]
    for q in queries:
        chunks = await r.retrieve_relevant_chunks(q, similarity_threshold=0.65)
        print(f"Query: '{q}' -> Chunks found: {len(chunks)}")
        if chunks:
            print(f"   Top: {chunks[0]['episode']} (Guest: {chunks[0]['guest']}, Score: {chunks[0]['score']})")

if __name__ == "__main__":
    asyncio.run(check())
