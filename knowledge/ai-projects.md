# Getacher Ashebir: AI and RAG projects

## RAG From Scratch (Python)

A Retrieval-Augmented Generation pipeline that Getacher built in plain Python without LangChain or LlamaIndex, to understand every step. It loads PDFs, splits them into overlapping chunks, creates embeddings with sentence-transformers, stores them in PostgreSQL with pgvector, retrieves the closest chunks for a question and generates an answer with page citations using a local Hugging Face model.

Repository: https://github.com/gecher/rag-from-scratch

## RAG Chat (React and FastAPI)

A full web application for asking questions about PDF documents. It has a React and TypeScript chat interface with a landing page, a FastAPI backend, streaming answers that appear word by word, sources shown before the answer, and clickable citations that open the source passage.

Repository: https://github.com/gecher/rag-chat

## DocuMind (ASP.NET Core)

A RAG API built with ASP.NET Core and Clean Architecture. Users upload PDFs, which are processed by a background service with status tracking, then ask questions and receive streamed answers with citations. It uses PostgreSQL with pgvector through EF Core, Gemini models, and supports both vector search and hybrid search with Reciprocal Rank Fusion.

Getacher built an evaluation tool for DocuMind that measures retrieval quality with hit rate and mean reciprocal rank (MRR). On a test set of 20 questions, vector search scored an MRR of 0.95 and hybrid search 0.82. He traced the difference to very common words dominating keyword search, made vector search the default, and kept hybrid search as a configuration option.

Repository: https://github.com/gecher/documind

## Ask Getacher (this website)

This website. Visitors can ask questions about Getacher's experience and projects, and answers are generated only from his CV and project descriptions, with the source of each answer shown. It uses a React frontend, a Node.js and Express API, PostgreSQL with pgvector on Neon, and Gemini models, deployed on Vercel.
