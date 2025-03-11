# Jarvis 3D - Voice-Activated AI Assistant

**Experience the future of AI interaction with Jarvis 3D** - a stunning visual AI assistant that combines cutting-edge 3D visualization with the intelligence of OpenAI's powerful models. Speak naturally to Jarvis and watch as it responds with lifelike animations and thoughtful answers. The elegant, responsive interface works seamlessly across desktop and mobile devices, bringing science fiction to reality. Whether you need quick information, assistance with tasks, or just a conversation partner, Jarvis 3D delivers an immersive AI experience that feels magical yet intuitive. Perfect for both practical applications and showcasing the possibilities of modern web technology.

## Features

- 3D visualization using Three.js and React Three Fiber
- Voice recognition using the Web Speech API
- Text-to-speech output using the Web Speech API
- Integration with OpenAI's API for intelligent responses
- Modern UI with real-time status indicators
- Responsive design for both desktop and mobile
- Minimizable chat interface for better screen real estate management
- Conversation history with timestamp tracking
- Elegant visual feedback for listening and speaking states

## Tech Stack

- **Frontend Framework**: Next.js 14 with App Router
- **3D Rendering**: Three.js with React Three Fiber and Drei
- **Styling**: Tailwind CSS for responsive design
- **AI Integration**: OpenAI API (supporting o3-mini and GPT-3.5 Turbo models)
- **Speech**: Web Speech API for voice recognition and text-to-speech
- **Deployment**: Ready for Vercel deployment

## Key Components

- **JarvisScene**: 3D visualization with dynamic animations responding to interaction states
- **VoiceRecognition**: Custom hook for handling speech recognition and synthesis
- **JarvisInterface**: Main component handling the UI and conversation flow
- **OpenAI API Route**: Serverless function integrating with OpenAI's models

## Prerequisites

- Node.js 18.x or higher
- An OpenAI API key

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/yourusername/jarvis-3d.git
cd jarvis-3d
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

- Click the "Talk to Jarvis" button to start voice recognition
- Speak clearly into your microphone
- Jarvis will process your request and respond both visually and audibly
- You can also type your message in the text input field and click "Send"

## Browser Compatibility

The voice recognition features work best in Chrome and Edge browsers. Some features may not be available in all browsers due to Web Speech API compatibility.

## Customizing the 3D Model

To use your own 3D model:

1. Place your GLTF/GLB model file in the `public/models` directory
2. Update the `JarvisModel` component in `app/components/JarvisScene.tsx` to use your model

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Three.js](https://threejs.org/)
- [OpenAI](https://openai.com/)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Future Plans

- Enhanced 3D model with more expressive animations
- Multi-language support for global accessibility
- Custom voice and personality options
- Integration with additional AI providers
- Local processing options for improved privacy
- Context-aware responses based on user preferences
- Expanded visualization capabilities for data presentation
"# jarvis-3d" 
