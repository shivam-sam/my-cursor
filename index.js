import {OpenAI} from 'openai';
import { exec } from 'node:child_process';
import { parse } from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

const OPENAI_KEY = process.env.OPEN_API_KEY;

const client = new OpenAI({apiKey: OPENAI_KEY});

function getWeatherInfo(cityName) {
    return `${cityName} has 42 degrees C` 
};

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, function(err, stdout, stderr) {
            if (err) {
                return reject(err);
            }

            resolve(`stdout: ${stdout}\nstderr:${stderr}`);
        });
    });
};

const TOOLS_MAP = {
    getWeatherInfo: getWeatherInfo,
    executeCommand: executeCommand,
};

const SYSTEM_PROMPT = `
    You are a helpful AI assistant who is designed to resolve user query.
    You work on START, THINK, ACTION, OBSERVE and OUTPUT mode.

    In the START phase, user gives a query to you.
    Then, you THINK how to resolve that query.
    If there is a need to call a tool, you call an ACTION event with the tool and input parameters.
    If there is an ACTION call, wait for the ACTION to complete and then OBSERVE the output of the call.
    Based on the OBSERVE from previous step, you either output or repeat the loop.

    Rules:
    - Always wait for the next step.
    - Always output a single step and wait for the next step.
    - Only call tool action from Available tools.
    - Strictly follow the output format in JSON

    Available Tools:
    - getWeatherInfo(city: string): Returns string
    - executeCommand(command): Returns string - Executes a given linux command on user's device and returns stdout or stderr.

    Example:
    START: What is weather of Patiala?
    THINK: The user is asking for the weather of Patiala.
    THINK: From the available tools, I must call getWeatherInfo tool for Patiala as input.
    ACTION: call the tool getWeatherInfo(Patiala)
    OBSERVE: 32 degree C
    THINK: The output of getWeatherInfo for Patiala is 32 Degrees C
    OUTPUT: Hey, the weather of Patiala is 32 Degree C which is quite hot 🥵

    Output Example:
    {"role": "user", "content": "What is the weather in Patiala?"}
    {"step": "think", "content": "The user is asking for the weather in Patiala"}
    {"step": "think", "content": "From the available tools, I must use getWeatherInfo tool for Patiala as input"}
    {"step": "action", "tool": "getWeatherInfo", "input": "Patiala"}
    {"step": "observe", "content": "32 Degrees C"}
    {"step": "think", "content": "The output of getWeatherInfo for Patiala is 32 Degrees C"}
    {"step": "output", "content": "Hey, the weather of Patiala is 32 Degree C which is quite hot 🥵"}

    OUTPUT Format:
    { "step": "string", "tool": "string", "input": "string", "content": "string"}
`

const messages = [
    { role: 'system', content: SYSTEM_PROMPT},
];

const userQuery = 'Create a folder todo app and create a fully working todo app using HTML, CSS and JS.'
messages.push({ 'role': 'user', 'content': userQuery});



async function init() {
    // Iteration 1: basic call to LLM
    // const resp = await client.chat.completions.create({
    //     model: 'gpt-4.1-mini',
    //     // these messages are basically a sequence of text conversation you are having with LLM.
    //     // this is where it stores the context of your conversation
    //     messages: [
    //         // Telling LLM about the custom tools and suggest user the available custom tools based on user prompt
    //         { role: 'system', content: SYSTEM_PROMPT},
    //         { role: 'user', content: 'Hey There'}
    //     ],
    // });
    // console.log(resp.choices[0].message.content);
    while (true) {
        const response = await client.chat.completions.create({
            model: 'gpt-4.1-mini',
            response_format: {type: 'json_object'},
            messages: messages
        })

        messages.push({ 'role': 'user', 'content': response.choices[0].message.content});
        const parsed_response = JSON.parse(response.choices[0].message.content);
        
        if (parsed_response.step && parsed_response.step === "think") {
            console.log(` 🧠: ${parsed_response.content}`);
            continue;
        }

        if (parsed_response.step && parsed_response.step === "output") {
            console.log(` 🎉: ${parsed_response.content}`);
            break;
        }

        if (parsed_response.step && parsed_response.step === "action") {
            const tool = parsed_response.tool;
            const input = parsed_response.input;

            const value = await TOOLS_MAP[tool](input);
            console.log(` ⚒️: Tool Call ${tool}(${input}): ${value}`);

            messages.push({ 
                'role': 'assistant', 
                'content': JSON.stringify({ step: 'observe', content: value}),
            });
            continue;
        }
    };

};

init();
