# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'dotenv/load'  # Add this line to load the .env file

# Pinecone Assistant chat implementation
PINECONE_API_KEY = ENV['PINECONE_API_KEY']
PINECONE_ENVIRONMENT = ENV['PINECONE_ENVIRONMENT']
ASSISTANT_NAME = ENV['ASSISTANT_NAME']

# Serve static files from the public directory
set :public_folder, 'public'

# Routes
get '/' do
  erb :index
end

get '/aframe' do
  erb :aframe, layout: :aframe_layout
end

get '/ar-studio' do
  send_file File.join(settings.public_folder, '/ar-studio/index.html')
end

post '/chat' do
  content_type :json
  message = JSON.parse(request.body.read)['message']
  response = query_pinecone_assistant(message)
  { response: response }.to_json
end

# Helper methods
def query_pinecone_assistant(message)
  uri = URI("https://#{PINECONE_ENVIRONMENT}.pinecone.io/assistant/chat/#{ASSISTANT_NAME}/chat/completions")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true

  request = Net::HTTP::Post.new(uri)
  request['Api-Key'] = PINECONE_API_KEY
  request['Content-Type'] = 'application/json'
  request.body = { messages: [{ role: 'user', content: message }] }.to_json

  response = http.request(request)

  if response.is_a?(Net::HTTPSuccess)
    result = JSON.parse(response.body)
    if result['choices'] && result['choices'].first && result['choices'].first['message']
      return result['choices'].first['message']['content']
    else
      return 'Unexpected response format from Pinecone API'
    end
  else
    return "Error: #{response.code} - #{response.message}"
  end
rescue => e
  return "Error: #{e.message}"
end

# Start the server if this file is run directly
if __FILE__ == $0
  set :run, true
  set :bind, '0.0.0.0'
end
