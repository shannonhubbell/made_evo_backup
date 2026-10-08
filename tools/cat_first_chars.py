import sys

def count_first_chars(file_path):
    first_char_count = {}

    with open(file_path, 'r') as file:
        for line in file:
            first_chars = line[:4]
            if first_chars in first_char_count:
                first_char_count[first_chars] += 1
            else:
                first_char_count[first_chars] = 1

    for chars, count in first_char_count.items():
        print(f"'{chars}': {count}")

if __name__ == "__main__":
    # file_path = '/Users/shemit/Projects/made_evo/tools/input.txt'  # Change this to your input file path
    file_path = sys.argv[1]
    count_first_chars(file_path)