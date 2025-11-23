#!/bin/bash

# Check if a message was passed as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <message>"
  exit 1
fi

curl --request POST \
  --url http://localhost:3000/api/v1/webhook/wapi \
  --header 'Content-Type: application/json' \
  --data "{
    \"dataType\": \"message\",
    \"data\": {
        \"message\": {
            \"ack\": 1,
            \"hasMedia\": false,
            \"body\": \"$1\",
            \"type\": \"chat\", 
            \"timestamp\": 1737371357,
            \"from\": \"554899255658@c.us\",
            \"to\": \"34693567509@c.us\",
            \"deviceType\": \"ios\",
            \"isStatus\": false,
            \"fromMe\": false,
            \"isGif\": false,
            \"links\": []
        }
    },
    \"sessionId\": \"test_clinic\"
  }"
