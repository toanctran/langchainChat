import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require('express');
const dotenv = require('dotenv');
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const { Server } = require('socket.io');

// const OpenAI = require('openai');
// const openaibot = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// })

import { OpenAI } from "langchain/llms/openai";
import { ConversationChain, ConversationalRetrievalQAChain, LLMChain, RetrievalQAChain  } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder,
} from "langchain/prompts";
import { BufferMemory, BufferWindowMemory } from "langchain/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { FaissStore } from "langchain/vectorstores/faiss";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { createRetrieverTool, createConversationalRetrievalAgent  } from "langchain/agents/toolkits";
import { initializeAgentExecutorWithOptions, loadAgent } from "langchain/agents";




const model = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName:process.env.OPENAI_EMBEDDING_MODEL,
  temperature: 0.5,
  topP: process.env.TOP_P,
  frequencyPenalty: process.env.FREQUENCY_PENALTY,
  presencePenalty : process.env.PRESENCE_PENALTY,
  maxTokens: process.env.MAX_TOKEN
});

const chat = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.5,
  modelName: process.env.CHATGPT_MODEL_NAME,
  topP: process.env.TOP_P,
  frequencyPenalty: process.env.FREQUENCY_PENALTY,
  presencePenalty : process.env.PRESENCE_PENALTY,
  maxTokens: process.env.MAX_TOKEN
});


/* Load in the file we want to do question answering over */
const loader = new TextLoader("./restaurant.txt");
const text = await loader.load();
/* Split the text into chunks */
const textSplitter = new CharacterTextSplitter({ chunkSize: 200, chunkOverlap: 50, });
const docs = await textSplitter.splitDocuments(text);
/* Create the vectorstore */
const embeddings = new OpenAIEmbeddings();
const vectorstore = await FaissStore.fromDocuments(docs, embeddings);
const retriever = vectorstore.asRetriever();
const buffer_memory = new BufferMemory({ returnMessages: true, memoryKey: "chat_history"})
const buffer_window_memory = new BufferWindowMemory({ memoryKey: "chat_history", k: 5, returnMessages: true, inputKey: "input"})
await vectorstore.save("./");


const chatPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "The following is a friendly conversation between a human and an AI. The AI is talkative, funny and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know."
  ),
  new MessagesPlaceholder("chat_history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

const chain_1 = new ConversationChain({
  memory: buffer_window_memory,
  prompt: chatPrompt,
  llm: chat,
});

const chain_2 = ConversationalRetrievalQAChain.fromLLM(
  model,
  retriever,
  {
    memory: buffer_window_memory,
  }
);

const llm = new LLMChain({ llm: model, prompt: chatPrompt})
const retriever_tool = createRetrieverTool(retriever, {
  name: "restaurant",
  description:
    "Searches and returns documents regarding restaurants.",
});


const executor = await initializeAgentExecutorWithOptions([retriever_tool], chat, {
  agentType: "chat-conversational-react-description",
  verbose: true,
});

// const executor = await createConversationalRetrievalAgent(chat, [retriever_tool], {
//   verbose: true,
// });

dotenv.config();
const app = express();
const httpServer = createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});


// app.post('/get_response', async (req, res) => {
//   let data = req.body;
//   let ChatCompletion = await openaibot.chat.completions.create({
//     messages: [{ role: 'user', content: data.user_input }],
//     model: 'gpt-3.5-turbo',
//   });
//   console.log(ChatCompletion.choices[0].message.content);
//   res.send(ChatCompletion.choices[0].message.content);
// })


app.post('/get_response', async (req, res) => {
  let data = req.body;
  console.log(data.user_input);
  let question = data.user_input
  let ChatCompletion = await executor.call({
    input: question
  });
  console.log(ChatCompletion)
  // res.send(ChatCompletion.response.replace(/\n/g, "<br />"))
  
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
