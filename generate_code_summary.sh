# Run this script with './generate_code_summary.sh'

#!/bin/bash

output_file="project_code_summary.txt"

# Clear the output file if it exists
> "$output_file"

# Loop through all files with specified extensions
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.html" -o -name "*.es6" -o -name "*.hbs" -o -name "*.scss" -o -name "*.yml" -o -name "*.rb" \) | while read -r file; do
    echo "==== FILE: $file ====" >> "$output_file"
    cat "$file" >> "$output_file"
    echo -e "\n\n" >> "$output_file"
done

echo "Code summary written to $output_file"
