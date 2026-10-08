import requests
import os
import json

ABSOLUTE_MADE_DIR = os.path.dirname(
    os.path.realpath(__file__)
) + "/.."

with open(
    os.path.join(ABSOLUTE_MADE_DIR, '.keys/google.json'), 'r') as file:
    data = json.load(file)


output = os.path.join(ABSOLUTE_MADE_DIR, '.staging/google_place.json')

API_KEY = data['google']['api_key']

def get_place(api_key, place_id):
    url = f"https://maps.googleapis.com/maps/api/place/details/json?key={api_key}&place_id={place_id}"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        return None

if __name__ == "__main__":
    place_id = 'ChIJfTK51q-Aj4ARI5bIG6D0BKQ'  # Replace with the actual place_id for the Museum of Art and Digital Entertainment
    place = get_place(API_KEY, place_id)
    if place:
        with open(output, 'w') as outfile:
            json.dump(place, outfile, indent=4)
    else:
        print("Failed to retrieve opening hours.")