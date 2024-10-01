# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'dotenv/load'
require 'uri'

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

# New route for proxying PDF requests
get '/proxy_pdf' do
  url = params[:url]
  uri = URI.parse(url)

  response = Net::HTTP.get_response(uri)

  if response.is_a?(Net::HTTPSuccess)
    content_type 'application/pdf'
    response.body
  else
    status 404
    "PDF not found"
  end
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
      content = result['choices'].first['message']['content']
      return process_pdf_references(content)
    else
      return 'Unexpected response format from Pinecone API'
    end
  else
    return "Error: #{response.code} - #{response.message}"
  end
rescue => e
  return "Error: #{e.message}"
end

def process_pdf_references(content)
  pdf_urls = extract_pdf_urls(content)

  # Replace PDF references with links
  content.gsub!(/\[(\d+),\s*pp\.\s*(\d+(?:-\d+)?)\]/) do |match|
    doc_index = $1
    pages = $2
    if pdf_urls[doc_index]
      url = pdf_urls[doc_index][:url]
      name = pdf_urls[doc_index][:name]
      "<a href=\"/proxy_pdf?url=#{URI.encode_www_form_component(url)}\" class=\"pdf-link\" data-pages=\"#{pages}\" title=\"#{name}\">#{match}</a>"
    else
      match
    end
  end

  content
end

def extract_pdf_urls(text)
  pdf_regex = /(\d+)\.\s+\[(.+?\.pdf)\]\((https?:\/\/[^\s)]+)\)/
  matches = text.scan(pdf_regex)

  pdf_map = {}
  matches.each do |index, name, url|
    pdf_map[index] = { name: name, url: url }
  end

  pdf_map
end

# Start the server if this file is run directly
if __FILE__ == $0
  set :run, true
  set :bind, '0.0.0.0'
end
