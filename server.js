import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require('express');
import { config } from "dotenv";
config();

const { createServer } = require('http');
const fs = require('fs');
const bodyParser = require('body-parser');

const { Server } = require('socket.io');

// const OpenAI = require('openai');
// const openaibot = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// })

import { OpenAI } from "langchain/llms/openai";
import {  RetrievalQAChain  } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChainTool, SerpAPI, WikipediaQueryRun } from "langchain/tools";
import { BufferMemory, BufferWindowMemory } from "langchain/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { FaissStore } from "langchain/vectorstores/faiss";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { createRetrieverTool, createConversationalRetrievalAgent, OpenAIAgentTokenBufferMemory  } from "langchain/agents/toolkits";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { HumanMessage, AIMessage } from "langchain/schema";
import { ChatMessageHistory } from "langchain/memory";
import { Calculator } from "langchain/tools/calculator";
import * as path from 'path';
import * as url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const embeddings = new OpenAIEmbeddings();

const llm = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName:process.env.OPENAI_EMBEDDING_MODEL,
  temperature: 0.5,
  topP: parseInt(process.env.TOP_P),
  frequencyPenalty: parseFloat(process.env.FREQUENCY_PENALTY),
  presencePenalty : parseFloat(process.env.PRESENCE_PENALTY),
  maxTokens: parseInt(process.env.MAX_TOKEN)
});

const chat = new ChatOpenAI({
  openAIApiKey: "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",
  temperature: 0.5,
  modelName: process.env.CHATGPT_MODEL_NAME,
  topP: parseInt(process.env.TOP_P),
  frequencyPenalty: parseFloat(process.env.FREQUENCY_PENALTY),
  presencePenalty : parseFloat(process.env.PRESENCE_PENALTY),
  maxTokens: parseInt(process.env.MAX_TOKEN)
});

const sys_message = 'The following is a friendly conversation between a human and Teddy.\n'+'Teddy is talkative, funny friend and he provides lots of specific details from its context.\nAI is constantly learning and improving, and its capabilities are constantly evolving. It is able to process and understand large amounts of text, and can use this knowledge to provide accurate and informative responses to a wide range of questions. Additionally, AI is able to generate its own text based on the input it receives, allowing it to engage in discussions and provide explanations and descriptions on a wide range of topics.\nOverall, Assistant is a powerful system that can help with a wide range of tasks and provide valuable insights and information on a wide range of topics. Whether you need help with a specific question or just want to have a conversation about a particular topic, Assistant is here to assist. However, above all else, all responses must adhere to the format of RESPONSE FORMAT INSTRUCTIONS.\nIf the AI does not know the answer to a question, it truthfully says it does not know.\n'
'Answer the following questions as best you can. You have access to the following tools:\n' +
'\n' +
'Frequency Asked Question: Useful to find the answer for frequent asked questions.\n' +
'search: a search engine. useful for when you need to answer questions about current events. input should be a search query.\n' +
'calculator: Useful for getting the result of a math expression. The input to this tool should be a valid mathematical expression that could be executed by a simple calculator.\n' +    
'wikipedia-api: A tool for interacting with and fetching data from the Wikipedia API.\n' +
'\n' +
'The tool Frequency Asked Question is highest priority.\n' +
'Use that tool first to answer the question.\n' +
'If you cannot find the answer there, use other tools later.\n' +
'\n' +
'Use the following format in your response:\n' +
'\n' +
'Question: the input question you must answer\n' +
'Thought: you should always think about what to do\n' +
'Action: the action to take, should be one of [Frequency Asked Question,search,calculator,wikipedia-api]\n' +
'Action Input: the input to the action\n' +
'Observation: the result of the action\n' +
'... (this Thought/Action/Action Input/Observation can repeat N times)\n' +
'Thought: I now know the final answer\n' +
'Final Answer: the final answer to the original input question\n' +
'\n' +
'Begin!\n' +
'\n' +
'Question: {input}\n' +
'Thought:{agent_scratchpad}'


export async function loadSalesDocVectorStore(FileName) {
  // your knowledge path
  const fullpath = path.resolve(__dirname, `./knowledge/${FileName}`);
  const loader = new TextLoader(fullpath);
  const docs = await loader.load();
  const splitter = new CharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 0,
  });
  const new_docs = splitter.splitDocuments(docs);
  return FaissStore.fromDocuments(docs, embeddings);
};

export async function setup_knowledge_base(FileName,llmModel) {
  const vectorStore = await loadSalesDocVectorStore(FileName);
  const knowledge_base = RetrievalQAChain.fromLLM(
    llmModel,
    vectorStore.asRetriever(),
    {
      inputKey:"input",
      outputKey: "output",
    }
  );
  return knowledge_base;
};

// export async function setup_knowledge_base_tool(FileName, toolName, toolDescription ) {
//   const vectorStore = await loadSalesDocVectorStore(FileName);
//   const retriever_tool = createRetrieverTool(vectorStore.asRetriever(), {
//     name: toolName,
//     description: toolDescription,
//   });
//   return retriever_tool
// };

const rejoin_tool = await setup_knowledge_base("rejoin.txt", chat);
// console.log(rejoin_tool)
const tools = [
    new ChainTool({
      name: "FrequencyAskedQuestion",
      description: "Use this at highest priority to answer the question.",
      rejoin_tool,
    }),
    new SerpAPI(),
    new Calculator(),
    new WikipediaQueryRun()
    ];

console.log(tools[0])
  const previousMessages = [
    new HumanMessage("My name is Bob"),
    new AIMessage("Nice to meet you, Bob!"),
  ];
  
  const chatHistory = new ChatMessageHistory(previousMessages);
const memory = new OpenAIAgentTokenBufferMemory({
  llm: chat,
  memoryKey: "chat_history",
  outputKey: "output",
  chatHistory,
});

const executor = await initializeAgentExecutorWithOptions(tools, chat, {
    agentType: "openai-functions",
    memory: memory,
    returnIntermediateSteps: true,
    verbose: false,
  });
// executor.agent.llmChain.prompt.template = sys_message


const app = express();
const httpServer = createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});



app.post('/get_response', async (req, res) => {
  let data = req.body;
  console.log(data.user_input);
  let question = data.user_input
  let ChatCompletion = await executor.call({
    input: question
  });
  console.log(ChatCompletion.output)
  res.send(ChatCompletion.output.replace(/\n/g, "<br />"))
  
  // let ChatCompletion = await chain_1.call({
  //   input: question,
  // })
  // console.log(ChatCompletion.response);
  // res.send(ChatCompletion.response);
})



app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('A new client connected');

  // Handle socket events here
});

const host = process.env.HOST; // Change the host address here
const port = process.env.PORT;
httpServer.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
