FROM ollama/ollama:latest

# Pre-pull the model during image build
RUN ollama serve & sleep 5 && ollama pull llama3:4b

EXPOSE 11434

ENTRYPOINT ["ollama", "serve"]
