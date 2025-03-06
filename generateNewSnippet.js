import fs from "fs";
import generateEmailSnippetsR1 from "./generateTestSnippetR1.js";

async function processExistingData() {
  try {
    console.log('Starting to read output.json...');
    const rawData = fs.readFileSync('output.json', 'utf8');
    const existingData = JSON.parse(rawData);
    console.log(`Successfully read data for ${existingData.length} entries`);

    // Process each entry in the existing data
    console.log('Starting to process entries...');
    const updatedData = await Promise.all(
      existingData.map(async (entry, index) => {
        try {
          console.log(`\nProcessing entry ${index + 1}/${existingData.length} - Username: ${entry.username}`);
          
          // Extract existing data
          const {
            username,
            biography,
            caption1,
            caption2,
            caption3,
            caption4,
            caption5
          } = entry;

          // Collect captions into an array
          const captions = [caption1, caption2, caption3, caption4, caption5]
            .filter(caption => caption); // Remove empty captions
          
          console.log(`Found ${captions.length} valid captions for ${username}`);
          console.log('Biography length:', biography?.length || 0);

          console.log(`Generating new snippet for ${username}...`);
          // Generate new snippet using existing data
          const r1Result = await generateEmailSnippetsR1(username, captions, biography);
          console.log(`Successfully generated new snippet for ${username}`);

          // Return existing data with new field
          const updatedEntry = {
            ...entry,
            'deepseek-r1-new': r1Result.snippet
          };

          console.log(`Completed processing for ${username}\n`);
          return updatedEntry;

        } catch (error) {
          console.error(`\nError processing entry for ${entry.username}:`, error);
          console.error('Error details:', error.message);
          console.error('Stack trace:', error.stack);
          return entry; // Return original entry if processing fails
        }
      })
    );

    console.log('\nAll entries processed. Writing updated data to file...');
    
    // Write updated data back to file
    fs.writeFileSync(
      'output.json',
      JSON.stringify(updatedData, null, 2),
      'utf8'
    );

    console.log('Successfully wrote updated data to output.json');
    
    // Log some statistics
    const successfulUpdates = updatedData.filter(entry => entry['deepseek-r1-new']).length;
    console.log('\nProcessing Summary:');
    console.log(`Total entries processed: ${updatedData.length}`);
    console.log(`Successful updates: ${successfulUpdates}`);
    console.log(`Failed updates: ${updatedData.length - successfulUpdates}`);

    return updatedData;
  } catch (error) {
    console.error('\nFatal error processing file:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Call the function with additional logging
console.log('Starting the process...');
processExistingData()
  .then(() => console.log('\nProcess completed successfully'))
  .catch(error => {
    console.error('\nProcess failed:', error);
    process.exit(1);
  });