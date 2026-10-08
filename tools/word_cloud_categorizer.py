import sys
from collections import Counter
import string
from nltk.stem import WordNetLemmatizer

def count_words(file_path):
    with open(file_path, 'r') as file:
        text = file.read()
    
    text = text.replace('’', "'")
    words = text.split()
    word_counts = Counter(words)

    word_counts = dict(sorted(word_counts.items(), key=lambda item: item[1], reverse=True))
    

    pronouns_prepositions = {'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 
                             'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 
                             'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 
                             'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 
                             'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 
                             'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 
                             'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 
                             'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 
                             'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 
                             'now'}
    
    pronouns_prepositions_abb = ({'i\'m', 'you\'re', 'he\'s', 'she\'s', 'it\'s', 'we\'re', 'they\'re', 'i\'ve', 'you\'ve', 'we\'ve', 'they\'ve', 
                                  'i\'d', 'you\'d', 'he\'d', 'she\'d', 'we\'d', 'they\'d', 'i\'ll', 'you\'ll', 'he\'ll', 'she\'ll', 'we\'ll', 
                                  'they\'ll', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'hasn\'t', 'haven\'t', 'hadn\'t', 'doesn\'t', 'don\'t', 
                                  'didn\'t', 'won\'t', 'wouldn\'t', 'shan\'t', 'shouldn\'t', 'can\'t', 'cannot', 'couldn\'t', 'mustn\'t', 'let\'s', 
                                  'that\'s', 'who\'s', 'what\'s', 'here\'s', 'there\'s', 'when\'s', 'where\'s', 'why\'s', 'how\'s', 'i\'ll'})

    word_counts = {word: count for word, count in word_counts.items() if word.lower() not in pronouns_prepositions}
    word_counts = {word: count for word, count in word_counts.items() if word.lower() not in pronouns_prepositions_abb}
    word_counts = {word: count for word, count in word_counts.items() if count >= 20}
    word_counts = {word: count for word, count in word_counts.items() if not word.isdigit()}
    
    for word, count in word_counts.items():
        print(f"{word}: {count}")

    

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python word_cloud_categorizer.py <input_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    count_words(input_file)