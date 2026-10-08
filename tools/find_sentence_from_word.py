import re
import sys

def find_sentences_with_word(file_path, word):
    with open(file_path, 'r') as file:
        text = file.read()
    
    # Split text into lines
    # lines = re.split(r'[\r\n]+', text)
    # Split text into sentences
    # sentences = re.split(r'(?<=[.!?])+ |[\r\n]+', text)
    # Split text into sentences
    sentences = re.split(r'(?<=[.!?]) +|[\r\n]+', text)
    
    # Find and print sentences containing the word
    for sentence in sentences:
        if word in sentence:
            print(sentence)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python find_sentence_from_word.py <file_path> <word>")
    else:
        file_path = sys.argv[1]
        word = sys.argv[2]
        find_sentences_with_word(file_path, word)